
define(['/webbox/webbox-ns.js', '/webbox/webbox-config.js'],
       function(ns, configbox) {
	   var config = configbox.config;
	   console.log("Config .... ", config);
	   var make_kb = function() {
	       return $.rdf.databank([], {base: ns.base, namespaces:ns.ns});
	   };
	   var ping = function(url) {
	       var query = "SELECT ?s ?p ?o WHERE { ?s ?p ?o . } LIMIT 1";
	       var get = $.ajax({ type:"GET", url:(url || config.webbox_url)+"/sparql/", data:{query:query}});
	       var D = new $.Deferred();
	       get.success(D.resolve).error(D.reject);
	       return D.promise();
	   };
	   // @Deprecated, should not be used	   
	   var make_spo_query = function(query, cont) {
		var get = $.ajax({ type:"GET", url:config.webbox_url+"/sparql/", data:{query:query}});
		var kb = make_kb();
		get.then(function(doc){
			     var results = [];
			     kb.load(doc, {});
			     $.rdf({databank:kb}).where('?s ?p ?o').each(
			     function() {
				 results.push(
				     {s:this.s ? this.s.value : undefined,
				      p:this.p ? this.p.value : undefined,
				      o:this.o ? this.o.value : undefined });
			     });
			     if(cont) { cont(results); }
			 });
	   };
	   
	   var get_sp_object = function(subject, predicate, graph) {
	       // subject should be a uri,
	       subject = ns.expand(subject.toString());
	       predicate = ns.expand(predicate.toString());
	       var d = new $.Deferred();
	       var query = graph ?
		   _("SELECT ?o WHERE { GRAPH \<<%= g %>\> { \<<%=s%>\> \<<%=p%>\> ?o . }} LIMIT 100000").template({s:subject,p:predicate, g:graph}) :
	       _("SELECT ?o WHERE { \<<%=s%>\> \<<%=p%>\> ?o . } LIMIT 100000").template({s:subject,p:predicate});
	       console.log("get_value query ", query, config.webbox_url);
	       var get = $.ajax({ type:"GET", url:config.webbox_url+"/sparql/", data:{query:query}}).then(
		   function(doc) {
		       var lits = $(doc, "results").find('literal');
		       if (lits.length > 0) {
			   d.resolve(lits.map(function() { return $(this).text(); }));
			   return;
		       }
		       var uris = $(doc, "results").find('uri');
		       if (uris.length > 0) {
			   d.resolve(uris.map(function() { return $(this).text(); }));
		       }		       
		   });
	       return d.promise();	       
	   };	   
	   
	   var get_graphs = function() {
	       // gets list of distinct ORM entities in the KB:
	       // TODO: make this more efficient so that we don't have to parse all the triples	       
	       var query = "CONSTRUCT { ?g a <http://webbox.ecs.soton.ac.uk/webbox/Object> } WHERE { GRAPH ?g { ?s ?p ?o. } } LIMIT 100000";
	       console.log("get_graphs() calling ", config, config.webbox_url+"/sparql/");
	       var get = $.ajax({ type:"GET", url:config.webbox_url+"/sparql/", data:{query:query}});
	       var kb = make_kb();
	       var gs = [];
	       var d = new $.Deferred();
	       get.then(function(doc){
			    kb.load(doc, {});
			    $.rdf({databank:kb}).where('?s ?p ?o').each(
				function() {
				    var graph = this.s.value.toString();
				    gs.push(graph);
				});
			    d.resolve(gs);
			}).fail(d.reject);
	       return d.promise();
	   };
	   
	   return {
	       ping:ping,
	       make_kb:make_kb,
	       get_graphs:get_graphs,
	       get_sp_object:get_sp_object
	   };
       });