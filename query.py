import urllib.request
import json

url = "https://omnipathdb.org/interactions?genesymbols=1&format=json"
data = urllib.parse.urlencode({'proteins': 'KRAS,RAF1,MAPK1,PIK3CA,AKT1,PTEN,TP53,RB1,CDK4,BAX,BCL2,CASP3,VEGFA,KDR,HIF1A'}).encode('ascii')
try:
    req = urllib.request.Request(url, data)
    with urllib.request.urlopen(req) as response:
        print(response.read().decode('utf-8')[:500])
except Exception as e:
    print("Error:", e)
