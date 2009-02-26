/* megaupload specific info */
var username = '';
var password = '';
var cookie = '';

var login_url = 'http://www.megaupload.com/?c=account';
var multifetch_url = 'http://www.megaupload.com/?c=multifetch';

/* exit handler */
var app = air.NativeApplication.nativeApplication;
app.autoExit = true;
app.addEventListener(air.Event.EXITING, exitHandler); 

var separator = '<~|~>';

/* deal with prefs */
function exitHandler(event) {
	var username = Ext.getCmp('username').getRawValue();
	var password = Ext.getCmp('password').getRawValue();
	var stream = new air.FileStream();
	stream.open(prefsFile, air.FileMode.WRITE);
	stream.writeUTFBytes([username, password].join(separator));
	stream.close();
}

function getPrefs() {
	var stream = new air.FileStream();
	if (prefsFile.exists) {
		stream.open(prefsFile, air.FileMode.READ);
		var prefs = stream.readUTFBytes(stream.bytesAvailable);
		var data = prefs.split(separator);
		Ext.getCmp('username').setValue(data[0]);
		Ext.getCmp('password').setValue(data[1]);
		stream.close();
	}
}

/* definitions */
var store =  new Ext.data.Store({
	data: [],
	reader: new Ext.data.ArrayReader({}, ['link', 'status'])
});

var model = Ext.data.Record.create(['link', 'status']);

var grid = new Ext.grid.GridPanel({
	stripeRows: true,
	viewConfig: {
		forceFit: true
	},
	frame: true,
	store: store,
	columns: [
		{header: 'Link to fetch', dataIndex: 'link', sortable: true},
		{header: 'Status', dataIndex: 'status', sortable: true}
	],
	bbar: [{
		xtype: 'tbfill'
	}, {
		xtype: 'tbbutton',
		id: 'fetchButton',
		text: 'Start Fetching',
		icon: '../images/bullet_go.png',
		cls: 'x-btn-text-icon',
		handler: fetch
	}]
});

/* import */
function browseTXT(event) {
	var defaultDir = air.File.userDirectory;
	var fileChooser = defaultDir;
	fileChooser.browseForOpen('Open');
	fileChooser.addEventListener(air.Event.SELECT, doImport);
}
 
function doImport(event) {
	var stream = new air.FileStream();
	var currentFile = event.target;
	stream.open(currentFile, air.FileMode.READ);
	
	var links = stream.readUTFBytes(stream.bytesAvailable).match(/(ftp|https?):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/ig);
	grid.getStore().removeAll();
	$.each(links, function(i, link) {
		grid.getStore().insert(i, new model({link: link, status: 'Not yet started'}));
	});
	
	stream.close();
	event.target.removeEventListener(air.Event.SELECT, doImport);
}

/* fetch */
function fetch() {
	username = Ext.getCmp('username').getRawValue();
	password = Ext.getCmp('password').getRawValue();
	if (cookie == '') login(); else realFetch();
}

function login() {
	Ext.getCmp('statusBar').showBusy('Logging into MegaUpload...');
	var xhr = $.post(login_url, {login: 1, username: username, password: password}, function(data) {
		Ext.getCmp('statusBar').clearStatus();
		if (data.match(/Username and password do not match\. Please try again!/i)) {
			Ext.getCmp('statusBar').setStatus('Login failed. Please double check your account info.');
		} else {
			Ext.getCmp('statusBar').setStatus('Logged in as ' + username + '.');
			cookie = xhr.getResponseHeader('Set-Cookie').match(/(user=[^;]*)/i)[1];
			realFetch();
		}
	});
}

function realFetch() {
	$.ajaxSetup({
		beforeSend: function(xhr) {
			xhr.setRequestHeader('Cookie', cookie);
		}
	});
	
	grid.getStore().each(function(row) {
		row.data.status = 'Submitting...';
		grid.getView().refresh();
		$.post(multifetch_url, {fetchurl: row.get('link'), description: row.get('link'), youremail: '', receiveremail: '', password: '', multiplerecipients: ''}, function(data) {
			row.data.status = 'Added to queue';
			grid.getView().refresh();
		});
	});
}