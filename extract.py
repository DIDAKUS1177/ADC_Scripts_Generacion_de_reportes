import os
import re

dirs = ['APP001_Espesores_UT', 'APP019_Riesgo_Duct_RBI']

for d in dirs:
    js_file = os.path.join(d, d + '.js')
    if not os.path.exists(js_file):
        continue
    with open(js_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find blocks like const MAPEO_X = { ... };
    pattern = re.compile(r'const\s+(MAPEO\w*)\s*=\s*(\{.*?\});', re.DOTALL)
    for match in pattern.finditer(content):
        name = match.group(1)
        obj_str = match.group(2)
        
        # We can extract key-value pairs using regex
        kv_pattern = re.compile(r'[''"]([^''"]+)[''"]\s*:\s*[''"]([^''"]+)[''"]')
        kvs = kv_pattern.findall(obj_str)
        
        if kvs:
            csv_path = os.path.join(d, name + '.csv')
            with open(csv_path, 'w', encoding='utf-8') as cf:
                cf.write('"Variable","Celda"\n')
                for k, v in kvs:
                    cf.write(f'"{k}","{v}"\n')
            print(f'Created {csv_path}')
