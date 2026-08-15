import requests

# 1. Login
login_url = "http://localhost:8000/api/token/"
credentials = {"username": "admin", "password": "Set-Your-Password"} # try default superuser or wait, let's create a user
res = requests.post(login_url, json=credentials)
print("Login status:", res.status_code)
if res.status_code == 200:
    token = res.json()['access']
    print("Token obtained")
    
    # 2. Test /api/updates/
    updates_url = "http://localhost:8000/api/updates/"
    headers = {"Authorization": f"Bearer {token}"}
    res2 = requests.get(updates_url, headers=headers)
    print("Updates status with header:", res2.status_code)
    print(res2.text)
    
    # Test without header
    res3 = requests.get(updates_url)
    print("Updates status without header:", res3.status_code)
    print(res3.text)
