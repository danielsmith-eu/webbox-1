define(
    [
        '/webbox/webbox-model.js',
        '/webbox/webbox-sync.js',
        '/webbox/util.js',
        '/webbox/webbox-config.js',
        '/webbox/webbox-testing.js',
        '/webbox/webbox-kb.js',
        '/webbox/webbox-ns.js',
        '/js/window-watcher.js',
        '/webbox/webbox-basic.js'
    ],
    function(m,sync,util,configbox,tests,wkb,ns,ww,basic) {
	var watcher = new ww.WindowWatcher();	
	watcher.bind("changed", function(x) {
			 if (configbox.config.weblogging == 'true') {
			     console.log("webbox::weblogging :: changed ", x);    
			 }
		     });

	var getTitle = function() {
	    var d = new $.Deferred();
	    chrome.windows.getLastFocused(
		function(window) {
		    chrome.tabs.getSelected(window.id,function(tab) { d.resolve(tab.title); });
		});
	    return d.promise();
	};

	// todo :: Move these to lightsaber/annotation module
	if (configbox.config.page_bookmarking) {
	    chrome.contextMenus.create(
		{
		    type:"normal",
		    title:"Bookmark Page",
		    contexts:["page"],
		    onclick:function(context) {
			try {
			    var model = m.get_resource(ns.me + "bookmark-"+((new Date()).valueOf()));
			    model.set2('rdf:type',wkb.resource(ns.expand('webbox:Bookmark')));
			    model.set2('webbox:url',wkb.string(context.pageUrl));
			    model.set2('dc:created',wkb.dateTime(new Date()));
			    getTitle().then(
				function(title) {
				    model.set2('dc:title',wkb.string(title));
				    model.set2('rdfs:label',wkb.string(title));
				    model.save();			    			    
				});			    
			} catch (x) {  console.error(x); }
		    }
		});	    
	    chrome.contextMenus.create(
		{
		    type:"normal",
		    title:"Save selection",
		    contexts:["selection"],
		    onclick:function(context) {
			try {
			    var model = m.get_resource(ns.me + "scrap-"+((new Date()).valueOf()));
			    model.set2('rdf:type', wkb.resource(ns.expand('webbox:Scrap')));
			    model.set2('webbox:url',wkb.string(context.pageUrl));
			    model.set2('webbox:contents', wkb.string(context.selectionText));
			    model.set2('rdfs:label', wkb.string(context.selectionText));
			    model.set2('dc:created',wkb.dateTime(new Date()));			
			    getTitle().then(
				function(title) {
				    model.set2('webbox:src_page_title',wkb.string(title));
				    model.save();			    			    
				});				    
			} catch (x) { console.error(x); }
		    }
		});
	}

        console.log("basic is === ", basic);
        
        basic.make_basic_types();
	
	console.log("Core extnding window .. ");
	_(window).extend({
			     m : m,
			     sync : sync,
			     util : util,
			     wkb : wkb,
			     ns : ns,
			     tests:tests,
			     config:configbox.config,
			     test_webbox : function() {
				  tests.run(); 
			     }
			 });
	return {};
    });
