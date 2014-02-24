var btnUpdate;
var statusTextField;
var networkSelector;
var btnRefreshNetworks;
var networkField;
var btnListNetworks;
var passwordField;
var passwordLabel;
var wifiboxURL;

var retrieveNetworkStatusDelay;
var retrieveNetworkStatusInterval = 1000;
var checkUpdateStatusDelay;
var checkUpdateStatusInterval = 1000;
var timeoutTime = 3000;

var DEFAULT_STATE 			= "default";
var CLEANING_STATE 			= "cleaning";
var CONNECTING_STATE 		= "connecting";
var DOWNLOADING_STATE 	= "downloading";
var UPDATING_STATE 			= "updating";
var UPDATED_STATE 			= "updated";
var ISSUE_STATE 				= "issue";

state = DEFAULT_STATE;

var NetworkStatus = {};
NetworkStatus.API_CONNECTING_FAILED  = -1
NetworkStatus.API_NOT_CONNECTED 			= 0
NetworkStatus.API_CONNECTING 					= 1
NetworkStatus.API_CONNECTED 					= 2
NetworkStatus.API_CREATING 						= 3
NetworkStatus.API_CREATED 						= 4

// states from api, see Doodle3D firmware src/script/d3d-updater.lua
var UpdateStatus = {};
UpdateStatus.NONE 								= 1; // default state 
UpdateStatus.DOWNLOADING  				= 2;
UpdateStatus.DOWNLOAD_FAILED 			= 3;
UpdateStatus.IMAGE_READY 					= 4; // download successfull and checked 
UpdateStatus.INSTALLING 					= 5;
UpdateStatus.INSTALLED 						= 6;
UpdateStatus.INSTALL_FAILED 			= 7;
  
var NETWORK_SELECTOR_DEFAULT = "default";
var NETWORK_SELECTOR_CUSTOM = "custom";
var networks;
var selectedNetwork;
var customNetwork = false;

$(function() {
  console.log("ready");

  networkSelector = $("#network");
  btnRefreshNetworks = $("#refreshNetworks");
  networkField = $("#ssid");
  btnListNetworks = $("#listNetworks");
  passwordField = $("#phrase");
  passwordLabel = $("#phraseLabel");
  btnUpdate = $("#btnUpdate");
  statusTextField = $("#statusText");
	
	btnRefreshNetworks.click(refreshNetworks);
	btnListNetworks.click(showNetworkSelector);
	btnUpdate.click(start);
	networkSelector.change(networkSelectorChanged);
	
	var hostname = "http://192.168.5.1";
	wifiboxURL = hostname+"/cgi-bin/d3dapi";	
	
	refreshNetworks();
});

function refreshNetworks() {
	console.log("refreshNetworks");
	
	$.ajax({
		url: wifiboxURL + "/network/scan",
		type: "GET",
		dataType: 'json',
		timeout: timeoutTime,
		success: function(response){
			console.log("refreshNetworks response: ",response);
			if(response.status == "error") {
				//clearTimeout(self.retrySaveSettingsDelay);
				//self.retrySaveSettingsDelay = setTimeout(function() { self.saveSettings() },self.retryDelay); // retry after delay
			} else {
				networks = {};
				var newNetworks = response.data.networks
				networkSelector.empty();
				networkSelector.append(
					$("<option></option>").val(NETWORK_SELECTOR_DEFAULT).html("please select")
				);
				$.each(newNetworks, function(index,element) {
					networkSelector.append(
						$("<option></option>").val(element.ssid).html(element.ssid)
					);
					networks[element.ssid] = element;
				});
				networkSelector.append(
					$("<option></option>").val(NETWORK_SELECTOR_CUSTOM).html("join other network...")
				);
			}
		}
	}).fail(function() {
		console.log("refreshNetworks failed");
		setState(ISSUE_STATE,"Could not retrieve networks, no box connected through ethernet cable?");
	});
}
function networkSelectorChanged(e) {
	var selectedOption = $(this).find("option:selected");
	selectNetwork(selectedOption.val());
}
function selectNetwork(ssid) {
	console.log("select network: ",ssid);
	if(ssid == "") return;
	selectedNetwork = ssid;
	//this.selectedNetwork = ssid;
  if(networks == undefined || ssid == NETWORK_SELECTOR_DEFAULT) {
  	hideWiFiPassword();
  } else if(ssid == NETWORK_SELECTOR_CUSTOM) {
  	showCustomNetworkInput();
  } else {
    var network = this.networks[ssid];
    if(network.encryption == "none") {
    	hideWiFiPassword();
    } else {
    	showWiFiPassword();
    }
    passwordField.val("");
  }
}
function showWiFiPassword() {
	passwordLabel.show();
  passwordField.show();
}
function hideWiFiPassword() {
	passwordLabel.hide();
	passwordField.hide();
}
function showNetworkSelector() {
	customNetwork = false;
	
	console.log("  form: ",$("form"));
	$("form").removeClass("customNetwork");
	networkSelector.val(NETWORK_SELECTOR_DEFAULT);
}
function showCustomNetworkInput() {
	customNetwork = true;
	console.log("  form: ",$("form"));
	$("form").addClass("customNetwork");
}

function start() {
	setState(CLEANING_STATE);
	removeNetworks();
}

var numRemoves = 5;
var numRemoved = 0;
	
function removeNetworks() {
	console.log("removeNetworks");
	setState(CLEANING_STATE);
	numRemoved = 0;
	removeNetwork();
}

function removeNetwork() {
	console.log("removeNetwork: ",numRemoved,numRemoves);
	var ssid = (customNetwork)? networkField.val() : selectedNetwork;
	console.log("  clean: ",ssid);
	var data = 	{	ssid:ssid };
	$.ajax({
		url: wifiboxURL + "/network/remove",
		dataType: 'json',
		data: data,
		type: "POST",
		success: function(response){
			console.log("network/remove response: ",response);
			
			numRemoved++;
			console.log("  remove: ",numRemoved,numRemoves);
			if(numRemoved < numRemoves) {
				removeNetwork();
			} else {
				connect();
			}
		}
	}).fail(function() {
		console.log("Network/remove failed");
		setState(ISSUE_STATE,"Can't clean networks");
	});
}

function connect() {
	setState(CONNECTING_STATE);
	var ssid = (customNetwork)? networkField.val() : selectedNetwork;
	console.log("connect to: ",ssid);
	var data = 	{	ssid:ssid,
								phrase:passwordField.val(),
								recreate:true
							};
	$.ajax({
		url: wifiboxURL + "/network/associate",
		dataType: 'json',
		data: data,
		type: "POST",
		success: function(response){
			// should timeout
			console.log("connection response: ",response);
		}
	}).fail(function() {
		console.log("connection timeout, is normal, webserver is restarting");
	});
	delayRetrieveNetworkStatus();
}
function delayRetrieveNetworkStatus() {
	clearTimeout(retrieveNetworkStatusDelay);
	retrieveNetworkStatusDelay = setTimeout(retrieveNetworkStatus,retrieveNetworkStatusInterval);
}
function retrieveNetworkStatus() {
	console.log("Settings:retrieveNetworkStatus");
	$.ajax({
		url: self.wifiboxURL + "/network/status",
		type: "GET",
		dataType: 'json',
		success: function(response){
			console.log("Settings:retrieveNetworkStatus response: ",response);
			if(response.status != "error") {
				var data = response.data;
				data.status = parseInt(data.status);
				console.log("  data.status: ",data.status,data.statusMessage);
				switch(data.status) {
					case NetworkStatus.API_CONNECTED: 
						downloadUpdate();
						return;
						break;
					case NetworkStatus.API_CONNECTING_FAILED: 
						setState(ISSUE_STATE,response.msg);
						return;
						break;
				}
			}
			delayRetrieveNetworkStatus();
		}
	}).fail(function() {
			console.log("Settings:retrieveNetworkStatus: failed");
			delayRetrieveNetworkStatus();
	});
}
function downloadUpdate() {
	setState(DOWNLOADING_STATE);
	$.ajax({
		url: self.wifiboxURL + "/update/download",
		type: "POST",
		dataType: 'json',
		success: function(response){
			console.log("downloadUpdate response: ",response);
		}
	}).fail(function() {
		console.log("downloadUpdate: failed");
	});
	delayCheckUpdateStatus();
}
function installUpdate() {
	setState(UPDATING_STATE);
	
	postData = {no_retain:true};
	$.ajax({
		url: wifiboxURL + "/update/install",
		type: "POST",
		data: postData,
		dataType: 'json',
		success: function(response){
			console.log("installUpdate response: ",response);
		}
	}).fail(function() {
		console.log("installUpdate: no respons (there shouldn't be)");
	});
	delayCheckUpdateStatus();
}
function delayCheckUpdateStatus() {
	clearTimeout(checkUpdateStatusDelay);
	checkUpdateStatusDelay = setTimeout(checkUpdateStatus,checkUpdateStatusInterval);
}
function checkUpdateStatus() {
	$.ajax({
		url: wifiboxURL + "/update/status",
		type: "GET",
		dataType: 'json',
		success: function(response){
			console.log("checkUpdateStatus response: ",response);
			if(response.status != "error") {
				var data = response.data;
				switch(data.state_code) {
					case UpdateStatus.IMAGE_READY: 
						installUpdate();
						return;
						break;
					case UpdateStatus.NONE: 
						setState(UPDATED_STATE);
						break;
					case UpdateStatus.DOWNLOAD_FAILED:
					case UpdateStatus.INSTALL_FAILED:
						setState(ISSUE_STATE,response.msg);
						break;
				}
			}
			delayCheckUpdateStatus();
		}
	}).fail(function() {
		console.log("checkStatus: failed (normal during installation)");
		delayCheckUpdateStatus();
	});
}

function setState(newState, msg) {
	console.log("setState: ",state,">",newState);
	var statusText = "";
	switch(newState) {
		case DEFAULT_STATE:
			break;
		case CLEANING_STATE:
			statusText = "Cleaning networks...";
			break;
		case CONNECTING_STATE:
			statusText = "Connecting...";
			break;
		case DOWNLOADING_STATE:
			statusText = "Downloading update...";
			break;
		case UPDATING_STATE:
			statusText = "Installing update...";
			break;
		case UPDATED_STATE:
			statusText = "Installation completed successfully!";
			break;
		case ISSUE_STATE:
			statusText = "Issue: "+msg;
			break;
	}
	statusTextField.html(statusText);
	state = newState;
}