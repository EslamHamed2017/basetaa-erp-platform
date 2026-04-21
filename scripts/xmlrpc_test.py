import subprocess, re, urllib.request

# Get testco admin password from control DB
r = subprocess.run(
    ['docker', 'exec', '-i', 'basetaa-odoo-deploy-db-1', 'psql',
     '-U', 'odoo', '-d', 'basetaa_control', '-t', '-c',
     'SELECT "odooAdminPassword" FROM tenants WHERE "normalizedSubdomain" = \'testco\';'],
    capture_output=True, text=True
)
pwd = r.stdout.strip()
print(f'Password length: {len(pwd)}')

# Step 1: Authenticate as admin
auth_xml = f'''<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>tenant_testco</string></value></param>
    <param><value><string>admin</string></value></param>
    <param><value><string>{pwd}</string></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>'''.encode()

req = urllib.request.Request(
    'http://localhost:8069/xmlrpc/2/common',
    data=auth_xml,
    headers={'Content-Type': 'text/xml'}
)
resp = urllib.request.urlopen(req, timeout=10)
body = resp.read().decode()
print('Auth response:', body.strip())

m = re.search(r'<int>(\d+)</int>', body)
if not m:
    print('AUTH FAILED — no UID in response')
    exit(1)

uid = int(m.group(1))
print(f'UID: {uid}')

# Step 2: Write new login + email + password
write_xml = f'''<?xml version="1.0"?>
<methodCall>
  <methodName>execute_kw</methodName>
  <params>
    <param><value><string>tenant_testco</string></value></param>
    <param><value><int>{uid}</int></value></param>
    <param><value><string>{pwd}</string></value></param>
    <param><value><string>res.users</string></value></param>
    <param><value><string>write</string></value></param>
    <param><value><array><data>
      <value><array><data>
        <value><int>{uid}</int></value>
      </data></array></value>
      <value><struct>
        <member><name>login</name><value><string>testco@basetaa-internal.test</string></value></member>
        <member><name>email</name><value><string>testco@basetaa-internal.test</string></value></member>
        <member><name>password</name><value><string>TestPass123!</string></value></member>
      </struct></value>
    </data></array></value></param>
    <param><value><struct/></value></param>
  </params>
</methodCall>'''.encode()

req2 = urllib.request.Request(
    'http://localhost:8069/xmlrpc/2/object',
    data=write_xml,
    headers={'Content-Type': 'text/xml'}
)
resp2 = urllib.request.urlopen(req2, timeout=10)
body2 = resp2.read().decode()
print('Write response:', body2.strip())

if '<boolean>1</boolean>' in body2:
    print('SUCCESS: credentials updated')
else:
    print('FAILURE: unexpected write response')
