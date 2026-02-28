import os
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
        models['ids2018_cnn'] = load_model('models/ids_2018_cnn_lstm.h5')
        scalers['ids2018'] = joblib.load('models/ids_2018_scaler.pkl')

        print("✅ All 9 NetShield assets loaded successfully.")
    except Exception as e:
        print(f"❌ Error loading models: {e}")

# Call loader on startup
load_all_assets()

# --- 2. Helper Functions ---
def preprocess_input(df, scaler_key, mode):
    scaler = scalers.get(scaler_key)
    if not scaler:
        raise ValueError(f"Scaler for {scaler_key} not found.")

    # Ensure numeric features and align to scaler expected columns if available
    df_numeric = df.select_dtypes(include=[np.number])
    n_rows = df.shape[0]
    if hasattr(scaler, "feature_names_in_"):
        expected = list(scaler.feature_names_in_)
        # Build aligned frame with correct row index to avoid scalar DataFrame error
        aligned = pd.DataFrame(index=np.arange(n_rows), columns=expected)
        for col in expected:
            if col in df_numeric.columns:
                aligned[col] = df_numeric[col].values
            else:
                aligned[col] = 0
    else:
        aligned = df_numeric if not df_numeric.empty else pd.DataFrame(index=np.arange(n_rows))

    # Scale data
    scaled_data = scaler.transform(aligned)
    
    # Reshape for Deep Learning if needed (CNN/LSTM expect 3D: [samples, features, 1])
    if "hybrid" in mode or "cnn" in mode or "bilstm" in mode:
        return scaled_data.reshape(scaled_data.shape[0], scaled_data.shape[1], 1)
    
    return scaled_data

# --- 3. API Endpoints ---

@app.get("/")
async def health_check():
    return {"status": "online", "system": "NetShield"}

@app.post("/analyze/{dataset}/{model_type}")
async def analyze_traffic(dataset: str, model_type: str, file: UploadFile = File(...)):
    """
    Main Analysis Endpoint
    dataset: sdn, nsl, cicids, ton, ids2018
    model_type: ml (RandomForest/DT/XGB) or dl (CNN/Hybrid)
    """
    # 2.1 File Validation
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        # Load CSV
        input_df = pd.read_csv(file.file)
        
        # Select correct model and scaler keys
        model_key = f"{dataset}_{'hybrid' if dataset=='sdn' and model_type=='dl' else 'dt' if dataset=='sdn' else 'cnn' if model_type=='dl' else 'rf'}"
        # Adjusting specifically for your unique filenames
        if dataset == 'nsl': model_key = f"nsl_{'bilstm' if model_type=='dl' else 'xgboost'}"
        
        current_model = models.get(model_key)
        
        # Preprocess
        processed_data = preprocess_input(input_df, dataset if dataset != 'nsl' else 'nsl', model_key)
        
        # 3.2 Attack Classification
        predictions = current_model.predict(processed_data)
        
        # Format results (Binary vs Multi-class handling)
        if model_type == 'dl':
            # For softmax/sigmoid outputs
            confidence = float(np.max(predictions[0]))
            label = "Attack" if np.argmax(predictions[0]) == 1 else "Normal"
        else:
            # For Scikit-learn outputs
            label = "Attack" if predictions[0] == 1 else "Normal"
            confidence = 1.0 # Standard ML models don't always provide probability easily

        # 3.1 & 3.4 Response Generation
        return {
            "filename": file.filename,
            "detection_mode": f"{dataset.upper()} - {model_type.upper()}",
            "prediction": label,
            "confidence_score": round(confidence, 4),
            "severity": "High" if label == "Attack" else "None",
            "message": f"{label} detected using NetShield {dataset.upper()} Pipeline."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-manual")
async def analyze_manual(payload: dict):
    try:
        df = pd.DataFrame([{
            "pktcount": float(payload.get("pktcount", 0)),
            "bytecount": float(payload.get("bytecount", 0)),
            "duration": float(payload.get("duration", 0)),
            "flows": float(payload.get("flows", 0)),
            "pktpersec": float(payload.get("pktpersec", 0)),
            "prio": float(payload.get("prio", 0))
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
        return {
            "prediction": label,
            "threat_score": round(score, 4),
            "message": "Unified manual analysis with SDN Hybrid."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        df = pd.DataFrame([{
            "pktcount": float(payload.get("pktcount", 0)),
            "bytecount": float(payload.get("bytecount", 0)),
            "duration": float(payload.get("duration", 0)),
            "flows": float(payload.get("flows", 0)),
            "pktpersec": float(payload.get("pktpersec", 0)),
            "prio": float(payload.get("prio", 0))
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
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
