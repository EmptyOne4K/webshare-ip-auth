// Webshare.io automatic IP authorization v0.0.2

// Config

const { webshare_token, check_cycle_time, remove_all_auths_on_startup } = require('./config.json');

// Libs

const https = require('https');
const { Buffer } = require('node:buffer');

// Functions

function webRequest(host, path, method = 'GET', token = null, postData = null)
{
	var options =
	{
		host: host,
		path: path,
		method: method,
		headers: token == null ? null :
		{
			"Authorization": "Token " + token,
		}
	};
	
	var statusCode;
	var responseHeaders;
	var responseBody = '';
	var postString = null;
	
	if (postData != null)
	{
		postString = JSON.stringify(postData);
		options.headers['Content-Type'] = 'application/json';
		options.headers['Content-Length'] = Buffer.byteLength(postString);
	}

	return new Promise
	(
		(resolve, reject) =>
		{
			const req = https.request
			(
				options,
				function (res)
				{
					statusCode = res.statusCode;
					responseHeaders = JSON.stringify(res.headers);
					
					if (statusCode < 200 || statusCode > 299)
					{
						console.log('[WARNING] STATUS: ' + statusCode);
						console.log('[WARNING] HEADERS: ' + responseHeaders);
					}
					
					res.setEncoding('utf8');
					res.on
					(
						'data',
						function (chunk)
						{
							responseBody += chunk;
						}
					);
					
					res.on
					(
						'end',
						function ()
						{
							if (statusCode < 200 || statusCode > 299)
							{
								console.log('[WARNING] RESPONSE: ' + responseBody);
								resolve (null);
							}
							else
							{
								if (statusCode == 204)
								{
									resolve (true);
								}
								else
								{
									try
									{
										const data = JSON.parse(responseBody);
										resolve (data);
									}
									catch (error)
									{
										await logError('[ERROR] Error while parsing response data: ' + error);
										console.log('Data: ' + responseBody);
										resolve (null);
									}
								}
							}
						}
					);
				}
			);

			req.on
			(
				'error',
				function (error)
				{
					await logError('[ERROR] Error during web request: ' + error.message);
					resolve (null);
				}
			);
			
			if (postString != null)
			{
				req.write(postString);
			}
			
			req.end();
		}
	);
}

function getRemoteIp()
{
	return new Promise
	(
		(resolve, reject) =>
		{
			const data = webRequest
			(
				'proxy.webshare.io',
				'/api/v2/proxy/ipauthorization/whatsmyip/'
			)
			.then
			(
				(data) => resolve (data['ip_address'])
			)
			.catch
			(
				await logError('[ERROR] Error while getting remote IP address: ' + error);
				(error) => resolve (null)
			);
		}
	);
}

function getIpAuthorizationList()
{
	return new Promise
	(
		(resolve, reject) =>
		{
			const data = webRequest
			(
				'proxy.webshare.io',
				'/api/v2/proxy/ipauthorization/',
				'GET',
				webshare_token
			)
			.then
			(
				(data) => resolve (data)
			)
			.catch
			(
				await logError('[ERROR] Error while getting IP authorization list: ' + error);
				(error) => resolve (null)
			);
		}
	);
}

function removeIpAuthorization(id)
{
	return new Promise
	(
		(resolve, reject) =>
		{
			const data = webRequest
			(
				'proxy.webshare.io',
				'/api/v2/proxy/ipauthorization/' + id + '/',
				'DELETE',
				webshare_token
			)
			.then
			(
				(data) => resolve (data)
			)
			.catch
			(
				await logError('[ERROR] Error while getting IP authorization list: ' + error);
				(error) => resolve (null)
			);
		}
	);
}

function addIpAuthorization(ip)
{
	return new Promise
	(
		(resolve, reject) =>
		{
			const data = webRequest
			(
				'proxy.webshare.io',
				'/api/v2/proxy/ipauthorization/',
				'POST',
				webshare_token,
				{'ip_address': ip}
			)
			.then
			(
				(data) => resolve (data)
			)
			.catch
			(
				await logError('[ERROR] Error while authorizing IP address: ' + error);
				(error) => resolve (null)
			);
		}
	);
}

function wait(msec)
{
	return new Promise
	(
		(resolve) =>
		{
			setTimeout
			(
				() =>
				{
					resolve (true);
				}, msec
			);
		}
	);
}

function log(message)
{
	var now = new Date().toISOString();
	console.log(now + ' ' + message);
}

function logError(message)
{
	var now = new Date().toISOString();
	console.error(now + ' ' + message);
}

// // Main

async function main()
{
	await log('[INFO] Startup.');
	
	// Get current remote IP address
	
	var lastRemoteIp = await getRemoteIp();
	while (lastRemoteIp == null)
	{
		await log('[ERROR] Could not get current remote IP address. Retrying in 10 seconds...');
		await wait(10000);
		lastRemoteIp = await getRemoteIp();
	}
	
	await log('[INFO] Current remote IP address: ' + lastRemoteIp);
	
	// Check current IP authorization list
	
	var ipAuthList = await getIpAuthorizationList();
	var ipAuthListResults = ipAuthList['results'];
	
	await log('[INFO] Current IP address authorizations: ' + ipAuthListResults.length);
	
	for (var i = 0; i < ipAuthListResults.length; i++)
	{
		await log(ipAuthListResults[i]['id'] + ' => ' + ipAuthListResults[i]['ip_address']);
	}
	
	// Wipe old IP authorizations
	
	var lastRemoteIpAuthorized = false;
	
	if (remove_all_auths_on_startup)
	{
		if (ipAuthListResults.length == 0)
		{
			await log('[INFO] IP authorization list is empty. Skipping revokes...');
		}
		else
		{
			await log('[INFO] Revoking all authorizations...');
			
			for (var i = 0; i < ipAuthListResults.length; i++)
			{
				if (await removeIpAuthorization(ipAuthListResults[i]['id']))
					await log('X ' + ipAuthListResults[i]['ip_address']);
			}
		}
	}
	else
	{
		// Check if current IP address is authorized
		
		for (var i = 0; i < ipAuthListResults.length; i++)
		{
			if (lastRemoteIp == ipAuthListResults[i]['ip_address'])
			{
				lastRemoteIpAuthorized = true;
				break;
			}
		}
	}
	
	if (lastRemoteIpAuthorized)
	{
		await log('[INFO] Current remote IP address is authorized.');
	}
	else
	{
		// Authorize current IP address
		
		await log('[INFO] Authorizing current IP address...');
		var addResponse = await addIpAuthorization(lastRemoteIp);
		
		if (addResponse == null)
		{
			await log('[ERROR] Error while authorizing IP address: ' + lastRemoteIp);
		}
		else
		{
			lastRemoteIpId = addResponse['id'];
			await log(addResponse['id'] + ' => ' + addResponse['ip_address']);
		}
	}
	
	// Start authorization cycle
	
	while (keepRunning)
	{
		await log('[INFO] Sleeping for ' + check_cycle_time + ' minutes...');
		await wait(check_cycle_time * 60 * 1000);
		
		const newRemoteIp = await getRemoteIp();
		while (newRemoteIp == null)
		{
			await log('[ERROR] Could not get current remote IP address. Retrying in 10 seconds...');
			await wait(10000);
			newRemoteIp = await getRemoteIp();
		}
		
		if (newRemoteIp == lastRemoteIp)
		{
			await log('[INFO] Remote IP address has not changed.');
		}
		else
		{
			await log('[INFO] New remote IP address: ' + newRemoteIp);
			await log('[INFO] Revoking old IP address: ' + lastRemoteIp);
			
			// Clear old auth list data
			
			ipAuthList = null;
			ipAuthListResults = null;
			
			if (lastRemoteIpId == null)
			{
				await log('[INFO] Getting authorization ID for old IP address...');
	
				ipAuthList = await getIpAuthorizationList();
				ipAuthListResults = ipAuthList['results'];
		
				for (var i = 0; i < ipAuthListResults.length; i++)
				{
					if (lastRemoteIp == ipAuthListResults[i]['ip_address'])
					{
						lastRemoteIpId = ipAuthListResults[i]['id'];
						await log('[INFO] Authorization ID: ' + lastRemoteIpId);
						break;
					}
				}
			}
			
			if (lastRemoteIpId == null)
			{
				await log('[WARNING] Old IP address does not seem to have been authorized. Skipping revoke...');
			}
			else
			{
				// Revoke old IP address authorization
				
				await log('[INFO] Revoking old IP address authorization...');
				if (await removeIpAuthorization(lastRemoteIpId))
					await log('X ' + lastRemoteIp);
				else
					await log('[ERROR] Error while revoking old IP address authorization.');
			}
			
			// Ensure auth list is loaded
			
			if (ipAuthList == null || ipAuthListResults == null)
			{
				await log('[INFO] Getting current IP address authorization list...');
				ipAuthList = await getIpAuthorizationList();
				ipAuthListResults = ipAuthList['results'];
			}
			
			lastRemoteIpAuthorized = false;
			
			await log('[INFO] Checking IP address authorization...');
			if (ipAuthList == null || ipAuthListResults == null)
			{
				await log('[ERROR] Could not get IP address authorization list. Skipping IP authorization check. Assuming current remote IP address is not authorized...');
			}
			else
			{
				// Check if current IP address is authorized
				
				for (var i = 0; i < ipAuthListResults.length; i++)
				{
					if (lastRemoteIp == ipAuthListResults[i]['ip_address'])
					{
						lastRemoteIpAuthorized = true;
						break;
					}
				}
			}
			
			// Authorize current IP address
			
			if (lastRemoteIpAuthorized)
			{
				await log('[INFO] Current remote IP address is authorized.');
			}
			else
			{
				await log('[INFO] Current remote IP address is not authorized. Authorizing new IP address...');
				var addResponse = await addIpAuthorization(lastRemoteIp);
				
				if (addResponse == null)
				{
					await log('[ERROR] Error while authorizing IP address: ' + lastRemoteIp);
				}
				else
				{
					lastRemoteIpId = addResponse['id'];
					await log(addResponse['id'] + ' => ' + addResponse['ip_address']);
				}
			}
			
			lastRemoteIp = newRemoteIp;
		}
	}
	
	await log('[INFO] Shutdown. Bye!');
}

// SIGINT handler

process.on('SIGINT', shutdown);

function shutdown()
{
	keepRunning = false;
	log('[INFO] Inited graceful shutdown.');
	wait(10000);
	process.exit();
}

// Init

global.keepRunning = true;
global.lastRemoteIp = null;
global.lastRemoteIpId = null;

// Start

main();