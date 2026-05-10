import requests
import json

def test_manual():
    url = "http://localhost:9091/api/netshield/analyze-manual"
    payload = {
        "features": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    }
    
    print("Sending Manual Probe request...")
    res = requests.post(url, json=payload)
    print("Status Code:", res.status_code)
    print("Response:", res.json())

if __name__ == "__main__":
    test_manual()
