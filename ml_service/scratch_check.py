import joblib
import tensorflow as tf
from tensorflow.keras.models import load_model

def check_model(name, path, is_dl=False):
    try:
        if is_dl:
            model = load_model(path)
            print(f"--- {name} (DL) ---")
            print("Output shape:", model.output_shape)
        else:
            model = joblib.load(path)
            print(f"--- {name} (ML) ---")
            if hasattr(model, 'classes_'):
                print("Classes:", model.classes_)
            else:
                print("No classes_ attribute")
    except Exception as e:
        print(f"Error loading {name}: {e}")

check_model('SDN Hybrid', 'models/sdn_hybrid.h5', True)
check_model('SDN DT', 'models/sdn_dt.pkl', False)
check_model('CICIDS CNN', 'models/cicids_2017_cnn.h5', True)
check_model('CICIDS RF', 'models/cicids_2017_rf.pkl', False)
check_model('ToN CNN', 'models/ton_iot_cnn.h5', True)
check_model('IDS2018 CNN', 'models/ids_2018_cnn_lstm.h5', True)

print("\n--- Scalers ---")
scalers = ['models/sdn_scaler.pkl', 'models/cicids_scaler.pkl', 'models/ids_2018_scaler.pkl', 'models/ton_iot_scaler.pkl']
for s in scalers:
    try:
        scaler = joblib.load(s)
        if hasattr(scaler, 'feature_names_in_'):
            print(f"{s}: {len(scaler.feature_names_in_)} features -> {list(scaler.feature_names_in_)[:5]}...")
        else:
            print(f"{s}: No feature_names_in_")
    except Exception as e:
        print(f"Error loading {s}: {e}")


        
