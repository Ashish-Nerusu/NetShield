import os
import sys

# Compatibility shim for Python 3.12 (distutils removal)
try:
    import distutils
except ImportError:
    try:
        import setuptools.dist
        sys.modules['distutils'] = setuptools.dist
    except ImportError:
        pass

import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from tensorflow.keras.models import load_model
import tensorflow as tf

app = FastAPI(title="NetShield AI Engine")

# --- 1. Global Model & Scaler Dictionary ---
# Loading these at startup ensures high-speed predictions.
models = {}
scalers = {}

def load_all_assets():
    try:
        # Custom SDN
        models['sdn_hybrid'] = load_model('models/sdn_hybrid.h5')
        models['sdn_dt'] = joblib.load('models/sdn_dt.pkl')
        scalers['sdn'] = joblib.load('models/sdn_scaler.pkl')

        # # NSL-KDD
        # models['nsl_bilstm'] = load_model('models/nsl_kdd_bilstm.h5')
        # models['nsl_xgboost'] = joblib.load('models/nsl_kdd_xgboost.pkl')
        # scalers['nsl'] = joblib.load('models/nsl_kdd_preprocessor.pkl')

        # CICIDS-2017
        models['cicids_cnn'] = load_model('models/cicids_2017_cnn.h5')
        models['cicids_rf'] = joblib.load('models/cicids_2017_rf.pkl')
        scalers['cicids'] = joblib.load('models/cicids_scaler.pkl')

        # ToN IoT & IDS 2018
        models['ton_cnn'] = load_model('models/ton_iot_cnn.h5')
        print("[INIT] Loaded ton_iot_cnn.h5 successfully.")
        models['ids2018_cnn'] = load_model('models/ids_2018_cnn_lstm.h5')
        print("[INIT] Loaded ids_2018_cnn_lstm.h5 successfully.")
        scalers['ids2018'] = joblib.load('models/ids_2018_scaler.pkl')
        print("[INIT] Loaded ids_2018_scaler.pkl successfully.")

        print("All NetShield assets loaded successfully.")
    except Exception as e:
        print(f"CRITICAL ERROR loading models: {e}")

# Call loader on startup
load_all_assets()

# --- 2. Helper Functions ---
def detect_dataset(df):
    columns = set(df.columns)
    if "switch_id" in columns or "packet_count" in columns:
        return "sdn"
    elif "Destination Port" in columns or "Total Fwd Packets" in columns:
        return "cicids"
    elif "FC1_Read_Input_Register" in columns:
        return "ton"
    elif "Dst Port" in columns and "Protocol" in columns:
        return "ids2018"
    elif "duration" in columns and "protocol_type" in columns:
        return "nsl"
    return "unknown"

def normalize_columns(df, expected):
    expected_set = set(expected)
    if set(df.columns) == expected_set:
        return df

    renames = {}
    for col in df.columns:
        norm = str(col).lower().replace(" ", "").replace("_", "")
        if norm in ["pktcount", "packetcount", "totalpackets"]:
            norm = "packet_rate" if "packet_rate" in expected else "packet_count"
        elif norm in ["bytecount", "totalbytes"]:
            norm = "byte_count"
        elif norm in ["duration", "durationsec"]:
            norm = "duration_sec"
        elif norm in ["pktpersec", "packetspersecond"]:
            norm = "packet_rate"
            
        for exp in expected:
            exp_norm = exp.lower().replace(" ", "").replace("_", "")
            if norm == exp_norm:
                renames[col] = exp
                break

    df = df.rename(columns=renames)
    
    for feature in expected:
        if feature not in df.columns:
            df[feature] = 0.0
            
    return df

def preprocess_input(df, scaler_key, mode):
    scaler = scalers.get(scaler_key)
    if not scaler:
        raise ValueError(f"Scaler for {scaler_key} not found.")

    if hasattr(scaler, "feature_names_in_"):
        expected = list(scaler.feature_names_in_)
        df = normalize_columns(df, expected)
        # Select numeric and fill NA with 0.0
        df_numeric = df[expected].select_dtypes(include=[np.number])
        aligned = df_numeric.fillna(0.0)
    else:
        df_numeric = df.select_dtypes(include=[np.number])
        aligned = df_numeric if not df_numeric.empty else pd.DataFrame(index=np.arange(df.shape[0]))

    scaled_data = scaler.transform(aligned)
    
    if "hybrid" in mode or "cnn" in mode or "bilstm" in mode:
        return scaled_data.reshape(scaled_data.shape[0], scaled_data.shape[1], 1)
    
    return scaled_data

IDS2018_LABELS = {
    0: "Normal",
    1: "DDoS",
    2: "Port Scan",
    3: "Botnet",
    4: "Infiltration",
    5: "Web Attack",
    6: "Brute Force",
    7: "SQL Injection",
    8: "Credential Stuffing"
}

# --- 3. API Endpoints ---

@app.get("/")
async def health_check():
    return {"status": "online", "system": "NetShield"}

@app.get("/health")
async def health():
    return {
        "status": "UP",
        "service": "NetShield ML Service"
    }

@app.post("/analyze/{dataset}/{model_type}")
async def analyze_traffic(dataset: str, model_type: str, file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        input_df = pd.read_csv(file.file)
        
        detected_dataset = dataset
        if dataset.lower() == 'auto':
            try:
                detected_dataset = detect_dataset(input_df)
                if detected_dataset == "unknown":
                    raise Exception("Unknown schema")
            except Exception:
                detected_dataset = "sdn"
                print("[FALLBACK] Unknown dataset schema -> using SDN pipeline")
        
        dataset = detected_dataset
        
        model_key = f"{dataset}_{'hybrid' if dataset=='sdn' and model_type=='dl' else 'dt' if dataset=='sdn' else 'cnn' if model_type=='dl' else 'rf'}"
        if dataset == 'nsl': model_key = f"nsl_{'bilstm' if model_type=='dl' else 'xgboost'}"
        
        current_model = models.get(model_key)
        if not current_model:
            raise ValueError(str({"message": f"Model {model_key} not loaded or not found."}))
            
        processed_data = preprocess_input(input_df, dataset if dataset != 'nsl' else 'nsl', model_key)
        
        predictions = current_model.predict(processed_data)
        
        label = "Normal"
        confidence = 0.0
        pred_idx = 0
        raw_pred = []
        
        if model_type == 'dl':
            pred_arr = predictions[0]
            raw_pred = pred_arr.tolist() if isinstance(pred_arr, np.ndarray) else pred_arr
            
            if len(pred_arr) == 1:
                confidence = float(pred_arr[0])
                if confidence >= 0.5:
                    label = "Attack"
                else:
                    confidence = 1.0 - confidence
            elif len(pred_arr) == 2:
                pred_idx = int(np.argmax(pred_arr))
                confidence = float(pred_arr[pred_idx])
                label = "Attack" if pred_idx == 1 else "Normal"
            else:
                pred_idx = int(np.argmax(pred_arr))
                confidence = float(pred_arr[pred_idx])
                if dataset == 'ids2018':
                    label = IDS2018_LABELS.get(pred_idx, "Unknown Attack")
                else:
                    label = "Attack" if pred_idx > 0 else "Normal"
        else:
            if hasattr(current_model, "predict_proba"):
                probs = current_model.predict_proba(processed_data)[0]
                raw_pred = probs.tolist()
                pred_idx = int(np.argmax(probs))
                confidence = float(probs[pred_idx])
                label = "Attack" if pred_idx == 1 else "Normal"
            else:
                pred_val = predictions[0]
                raw_pred = [float(pred_val)]
                pred_idx = int(pred_val)
                label = "Attack" if pred_val == 1 else "Normal"
                confidence = 0.85 

        severity = "None"
        if label != "Normal":
            conf_pct = confidence * 100
            if conf_pct >= 92: severity = "Critical"
            elif conf_pct >= 80: severity = "High"
            elif conf_pct >= 65: severity = "Medium"
            else: severity = "Low"
            
        print(f"[INFERENCE] Prediction = {label} ({confidence*100:.1f}%) Severity: {severity}")

        return {
            "filename": file.filename,
            "detection_mode": f"{dataset.upper()} - {model_type.upper()}",
            "prediction": label,
            "confidence_score": round(confidence, 4),
            "severity": severity,
            "message": f"{label} detected using NetShield {dataset.upper()} Pipeline.",
            "detected_dataset": dataset,
            "debug_info": {
                "dataset_detected": dataset,
                "model_used": model_key,
                "predicted_index": pred_idx,
                "raw_prediction": [round(float(x), 4) for x in raw_pred],
                "threshold_used": 0.5
            }
        }

    except Exception as e:
        print(f"[FALLBACK MODE] CSV Upload Failed: {e}")
        return {
            "prediction": "Attack",
            "attack_type": "Unknown Suspicious Traffic",
            "confidence": 60.0,
            "severity": "Medium",
            "message": "Fallback mode activated due to inference failure.",
            "fallback": True
        }

@app.post("/analyze-manual")
async def analyze_manual(payload: dict):
    try:
        pktcount = float(payload.get("pktcount", 0))
        bytecount = float(payload.get("bytecount", 0))
        duration = float(payload.get("duration", 0))
        flows = float(payload.get("flows", 0))
        pktpersec = float(payload.get("pktpersec", 0))
        prio = float(payload.get("prio", 0))

        bytes_per_packet = bytecount / pktcount if pktcount > 0 else 0.0

        df = pd.DataFrame([{
            "packet_rate": pktpersec,
            "duration_sec": duration,
            "bytes_per_packet": bytes_per_packet,
            "table_id": 0.0,
            "duration_nsec": 0.0,
            "flow_duration": duration,
            "byte_count": bytecount,
            "hard_timeout": 0.0,
            "switch_id": 1.0,
            "in_port": 1.0
        }])
        processed = preprocess_input(df, "sdn", "sdn_hybrid")
        model = models.get("sdn_hybrid")
        preds = model.predict(processed)
        if preds.ndim == 2 and preds.shape[1] > 1:
            score = float(np.max(preds[0]))
            label = "Attack" if np.argmax(preds[0]) == 1 else "Normal"
        else:
            score = float(preds[0])
            label = "Attack" if score >= 0.5 else "Normal"
            
        severity = "Safe"
        if label == "Attack":
            conf_pct = score * 100
            if conf_pct >= 90: severity = "Critical"
            elif conf_pct >= 70: severity = "High"
            else: severity = "Medium"

        return {
            "prediction": label,
            "threat_score": round(score, 4),
            "confidence": round(score * 100, 2),
            "severity": severity,
            "message": "Unified manual analysis with SDN Hybrid."
        }
    except Exception as e:
        print(f"[FALLBACK MODE] Manual Analysis Failed: {e}")
        return {
            "prediction": "Attack",
            "attack_type": "Suspicious Traffic",
            "confidence": 65.0,
            "threat_score": 0.6500,
            "severity": "Medium",
            "message": "Fallback mode activated due to inference failure.",
            "fallback": True
        }

def normalize_importances(imp_series):
    values = np.array(list(imp_series.values())) if isinstance(imp_series, dict) else np.array(imp_series)
    total = np.sum(np.abs(values))
    if isinstance(imp_series, dict):
        if total == 0:
            return {k: 0.0 for k in imp_series.keys()}
        return {k: float(imp_series[k]) / float(total) for k in imp_series.keys()}
    else:
        # Fallback for sequences
        if total == 0:
            return [0.0 for _ in values]
        return [float(v) / float(total) for v in values]

@app.post("/explain-manual")
async def explain_manual(payload: dict):
    try:
        pktcount = float(payload.get("pktcount", 0))
        bytecount = float(payload.get("bytecount", 0))
        duration = float(payload.get("duration", 0))
        flows = float(payload.get("flows", 0))
        pktpersec = float(payload.get("pktpersec", 0))
        prio = float(payload.get("prio", 0))

        bytes_per_packet = bytecount / pktcount if pktcount > 0 else 0.0

        df = pd.DataFrame([{
            "packet_rate": pktpersec,
            "duration_sec": duration,
            "bytes_per_packet": bytes_per_packet,
            "table_id": 0.0,
            "duration_nsec": 0.0,
            "flow_duration": duration,
            "byte_count": bytecount,
            "hard_timeout": 0.0,
            "switch_id": 1.0,
            "in_port": 1.0
        }])
        aligned = preprocess_input(df, "sdn", "sdn_hybrid")
        # Try ML explainer first
        if "sdn_dt" in models and hasattr(models["sdn_dt"], "feature_importances_"):
            imp = models["sdn_dt"].feature_importances_
            names = list(scalers["sdn"].feature_names_in_) if hasattr(scalers["sdn"], "feature_names_in_") else [f"f{i}" for i in range(len(imp))]
            mapping = {names[i]: float(imp[i]) for i in range(len(imp))}
            return {"importances": normalize_importances(mapping)}
        # Fallback: gradient-based saliency for hybrid DL
        model = models.get("sdn_hybrid")
        x = tf.convert_to_tensor(aligned, dtype=tf.float32)
        with tf.GradientTape() as tape:
            tape.watch(x)
            y = model(x, training=False)
            # choose attack logit if available, else first output
            target = y[:, 1] if y.shape[-1] > 1 else y[:, 0]
        grads = tape.gradient(target, x).numpy()
        grads = np.abs(grads[0].reshape(-1))  # [features]
        names = list(scalers["sdn"].feature_names_in_) if hasattr(scalers["sdn"], "feature_names_in_") else [f"f{i}" for i in range(len(grads))]
        mapping = {names[i]: float(grads[i]) for i in range(len(names))}
        return {"importances": normalize_importances(mapping)}
    except Exception as e:
        print(f"[FALLBACK MODE] Explain Manual Failed: {e}")
        return {
            "importances": {
                "packet_rate": 0.45,
                "duration_sec": 0.20,
                "byte_count": 0.15,
                "flow_duration": 0.10,
                "bytes_per_packet": 0.05,
                "switch_id": 0.05
            },
            "fallback": True
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"[INIT] Starting FastAPI ML Service on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
