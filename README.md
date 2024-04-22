# Webshare IP Auth

This is a IP authorization tool for [webshare.io](https://webshare.io). It periodically checks if your remote IP address has changed and keeps it authorized.

If you like my work, consider using my referral link: [referral](https://www.webshare.io/?referral_code=8vkbotf1wf3v).
(I get commissions for purchases made through this link.)

## Features

- Periodically checks your remote IP address against `https://proxy.webshare.io/api/v2/proxy/ipauthorization/whatsmyip/`.
- Checks if your IP authorization list contains your current remote IP address and adds it if necessary.
- Removes your old IP address from your authorization list before, so it does not fill up.
- [OPTIONAL] Wipes all authorizations from your list on startup.

## Installation
```shell
git clone https://github.com/EmptyOne4K/webshare-ip-auth.git && cd webshare-ip-auth
cp config.json.example config.json
```

Add your token to the config. This is required to access webshare's API.
If you do not know or have a token, you can get one on your [Dashboard](https://proxy2.webshare.io/userapi/keys).

## PM2
```shell
pm2 start main.js --name webshare-ip-auth
```

## Update
```shell
git pull
pm2 restart webshare-ip-auth
```