import requests

def test_analyze():
    # Test 1: SDN Dataset
    with open("test_sdn.csv", "w") as f:
        f.write("switch_id,in_port,packet_count,byte_count,duration_sec\n")
        f.write("1,2,3000,4000000,5\n")
    
    with open("test_sdn.csv", "rb") as f:
        print("Testing SDN dataset...")
        files = {"file": ("test_sdn.csv", f, "text/csv")}
        res = requests.post("http://127.0.0.1:8000/analyze/auto/dl", files=files)
        print("SDN Auto DL:", res.json())

    # Test 2: CICIDS Dataset
    with open("test_cicids.csv", "w") as f:
        f.write("Destination Port,Flow Duration,Total Fwd Packets,Total Backward Packets,Total Length of Fwd Packets\n")
        f.write("80,500,10,10,200\n")
    
    with open("test_cicids.csv", "rb") as f:
        print("\nTesting CICIDS dataset...")
        files = {"file": ("test_cicids.csv", f, "text/csv")}
        res = requests.post("http://127.0.0.1:8000/analyze/auto/dl", files=files)
        print("CICIDS Auto DL:", res.json())

if __name__ == "__main__":
    test_analyze()
