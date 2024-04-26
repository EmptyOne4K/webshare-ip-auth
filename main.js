// Webshare.io automatic IP authorization v0.0.3

// Config

const
{
	webshare_token,
	check_cycle_time,
	remove_all_auths_on_startup,
	external_ip_provider_script
} = require('./config.json');

// Libs

const https = require('https');
const { Buffer } = require('node:buffer');
const { exec } = require('child_process');

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
										logError('[ERROR] Error while parsing response data: ' + error);
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
					logError('[ERROR] Error during web request: ' + error.message);
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

function getRemoteIp(external_ip_provider_script)
{
	if (!external_ip_provider_script)
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
					(data) => resolve (data == null ? null : data['ip_address'])
				)
				.catch
				(
					() =>
					{
						logError('[ERROR] Error while getting remote IP address: ' + error);
						(error) => resolve (null)
					}
				);
			}
		);
	}
	else
	{
		return new Promise
		(
			(resolve, reject) =>
			{
				exec
				(
					external_ip_provider_script,
					(error, stdout, stderr) =>
					{
						if (error)
						{
							logError('[ERROR] Error while executing external IP address provider script: ' + error);
							resolve (null);
							return;
						}
						
						if (stderr)
						{
							logError('[ERROR] Error while executing external IP address provider script: ' + stderr);
							resolve (null);
							return;
						}
						
						resolve (stdout);
					}
				);
			}
		);
	}
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
				() =>
				{
					logError('[ERROR] Error while getting IP authorization list: ' + error);
					(error) => resolve (null)
				}
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
				() =>
				{
					logError('[ERROR] Error while getting IP authorization list: ' + error);
					(error) => resolve (null)
				}
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
				() =>
				{
					logError('[ERROR] Error while authorizing IP address: ' + error);
					(error) => resolve (null)
				}
			);
		}
	);
}

function parseIpAddress(ip)
{
	var ipParts = ip.split(',');
	var ipList = [];
	
	for (var n = 0; n < ipParts.length; n++)
	{
		var cleanIp = cleanString(ipParts[n]);
		if (cleanIp != '') ipList.push(cleanIp);
	}
	
	return ipList;
}

function getAddedIpAddresses(ipList)
{
	var ipListAdditions = [];
	
	for (var n = 0; n < ipList.length; n++)
	{
		var ipCached = false;
		
		for (var i = 0; i < remoteIpCache.length; i++)
		{
			if (remoteIpCache[i]['ip_address'] == ipList[n])
			{
				ipCached = true;
				break;
			}
			
			if (!keepRunning) return null;
		}
		
		if (!ipCached) ipListAdditions.push(ipList[n]);
	}
	
	return ipListAdditions;
}

function getRemovedIpAddresses(ipList)
{
	var ipListRemovals = [];
	
	for (var i = 0; i < remoteIpCache.length; i++)
	{
		var ipIncluded = false;
		
		for (var n = 0; n < ipList.length; n++)
		{
			if (remoteIpCache[i]['ip_address'] == ipList[n])
			{
				ipIncluded = true;
				break;
			}
			
			if (!keepRunning) return null;
		}
		
		if (!ipIncluded) ipListRemovals.push(remoteIpCache[i]['ip_address']);
	}
	
	return ipListRemovals;
}

function cleanString(line)
{
	return line.replace(' ', '').replace('\t', '').replace('\r', '').replace('\n', '')
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
	
	var currentRemoteIp = await getRemoteIp(external_ip_provider_script);
	while (currentRemoteIp == null)
	{
		await log('[ERROR] Could not get current remote IP address. Retrying in 10 seconds...');
		await wait(10000);
		currentRemoteIp = await getRemoteIp(external_ip_provider_script);
	}
	
	await log('[INFO] Current remote IP address: ' + currentRemoteIp);
	
	var parsedIpAddress = await parseIpAddress(currentRemoteIp);
	
	// Build initial IP address cache
	
	for (var n = 0; n < parsedIpAddress.length; n++)
		remoteIpCache.push({'ip_address': parsedIpAddress[n], 'auth_id': null});
	
	// Check current IP authorization list
	
	var ipAuthList = await getIpAuthorizationList();
	var ipAuthListResults = ipAuthList == null ? null : ipAuthList['results'];
	
	while (ipAuthList == null || ipAuthListResults == null)
	{
		await log('[ERROR] Could not get IP address authorization list. Retrying in 10 seconds...');
		await wait(10000);
		ipAuthList = await getIpAuthorizationList();
		ipAuthListResults = ipAuthList == null ? null : ipAuthList['results'];
	}
	
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
		
		if (ipAuthListResults.length == 0)
		{
			await log('[INFO] IP authorization list is empty. Skipping authorization checks...');
		}
		else
		{
			await log('[INFO] Checking IP authorizations...');
			
			for (var n = 0; n < remoteIpCache.length; n++)
				for (var i = 0; i < ipAuthListResults.length; i++)
				{
					if (remoteIpCache[n]['ip_address'] == ipAuthListResults[i]['ip_address'])
					{
						remoteIpCache[n]['auth_id'] = ipAuthListResults[i]['id'];
						break;
					}
				}
		}
	}
	
	for (var n = 0; n < remoteIpCache.length; n++)
		if (remoteIpCache[n]['auth_id'] != null)
		{
			await log('[INFO] Remote IP address "' + remoteIpCache[n]['ip_address'] + '" is authorized.');
		}
		else
		{
			// Authorize current IP address
			
			await log('[INFO] Authorizing IP address "' + remoteIpCache[n]['ip_address'] + '"...');
			var addResponse = await addIpAuthorization(remoteIpCache[n]['ip_address']);
			
			if (addResponse == null)
			{
				await log('[ERROR] Error while authorizing IP address: ' + remoteIpCache[n]['ip_address']);
			}
			else
			{
				remoteIpCache[n]['auth_id'] = addResponse['id'];
				await log(addResponse['id'] + ' => ' + addResponse['ip_address']);
			}
		}
	
	// Start authorization cycle
	
	while (keepRunning)
	{
		await log('[INFO] Sleeping for ' + check_cycle_time + ' minutes...');
		await wait(check_cycle_time * 60 * 1000);
		
		const newRemoteIp = await getRemoteIp(external_ip_provider_script);
		while (newRemoteIp == null)
		{
			await log('[ERROR] Could not get current remote IP address. Retrying in 10 seconds...');
			await wait(10000);
			newRemoteIp = await getRemoteIp(external_ip_provider_script);
		}
	
		await log('[INFO] Current remote IP address: ' + newRemoteIp);
		
		var parsedIpAddress = await parseIpAddress(newRemoteIp);
		
		// Diff old remote IP addresses with new ones
		
		var addedIpAddress = await getAddedIpAddresses(parsedIpAddress);
		var removedIpAddress = await getRemovedIpAddresses(parsedIpAddress);
		
		log('[INFO] Added IP addresses: ' + addedIpAddress);
		log('[INFO] Removed IP addresses: ' + removedIpAddress);
		
		// Update IP authorization list
		
		ipAuthList = await getIpAuthorizationList();
		ipAuthListResults = ipAuthList == null ? null : ipAuthList['results'];
	
		if (ipAuthList == null || ipAuthListResults == null)
		{
			await log('[ERROR] Could not get IP address authorization list. Retrying in next cycle...');
		}
		else
		{
			// Revoke authorizations for removed IP addresses

			for (var n = 0; n < removedIpAddress.length; n++)
			{
				var gotRevoked = false;
				
				for (var i = 0; i < ipAuthListResults.length; i++)
				{
					if (removedIpAddress[n] == ipAuthListResults[i]['ip_address'])
					{
						await log('[INFO] Revoking authorization for IP address "' + removedIpAddress[n] + '"...');
						if (await removeIpAuthorization(ipAuthListResults[i]['id']))
							await log('X ' + removedIpAddress[n]);
						else
							await log('[ERROR] Error while revoking authorization for IP address "' + removedIpAddress[n] + '".');
						
						var gotRevoked = true;
						break;
					}
				}
				
				if (!gotRevoked) await log('[WARNING] Authorization list did not include IP address "' + removedIpAddress[n] + '". No revoke needed.');
				
				// Remove IP address from cache
								
				for (var i = 0; i < remoteIpCache.length; i++)
				{
					if (remoteIpCache[i]['ip_address'] == removedIpAddress[n])
					{
						remoteIpCache.splice(i, 1);
						break;
					}
				}
			}
			
			// Authorize new IP addresses
			
			for (var n = 0; n < addedIpAddress.length; n++)
			{
				var authId = null;
				
				for (var i = 0; i < ipAuthListResults.length; i++)
				{
					if (addedIpAddress[n] == ipAuthListResults[i]['ip_address'])
					{
						authId = ipAuthListResults[i]['id'];
						remoteIpCache.push({'ip_address': addedIpAddress[n], 'auth_id': authId});
						break;
					}
				}
				
				if (authId == null)
				{
					await log('[INFO] IP address "' + addedIpAddress[n] + '" is not authorized. Authorizing...');
					var addResponse = await addIpAuthorization(addedIpAddress[n]);
					
					if (addResponse == null)
					{
						await log('[ERROR] Error while authorizing IP address: ' + addedIpAddress[n]);
					}
					else
					{
						authId = addResponse['id'];
						remoteIpCache.push({'ip_address': addedIpAddress[n], 'auth_id': authId});
						await log(addResponse['id'] + ' => ' + addResponse['ip_address']);
					}
				}
				else
				{
					await log('[INFO] IP address "' + addedIpAddress[n] + '" has already been authorized.');
				}
			}
			
			// Check if cached IP addresses are still authorized
			
			for (var n = 0; n < remoteIpCache.length; n++)
			{
				var authId = null;
				
				for (var i = 0; i < ipAuthListResults.length; i++)
				{
					if (remoteIpCache[n]['ip_address'] == ipAuthListResults[i]['ip_address'])
					{
						authId = ipAuthListResults[i]['id'];
						remoteIpCache[n]['id'] = authId;
						break;
					}
				}
				
				if (authId == null)
				{
					await log('[WARNING] Cached IP address "' + remoteIpCache[n]['ip_address'] + '" is not authorized. Authorizing...');
					var addResponse = await addIpAuthorization(remoteIpCache[n]['ip_address']);
					
					if (addResponse == null)
					{
						await log('[ERROR] Error while authorizing cached IP address: ' + remoteIpCache[n]['ip_address']);
					}
					else
					{
						authId = addResponse['id'];
						remoteIpCache[n]['id'] = authId;
						await log(addResponse['id'] + ' => ' + addResponse['ip_address']);
					}
				}
			}
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
global.remoteIpCache = [];

// Start

main();