// assumes require, $, $.rdf are defined
define(
    ['/webbox/webbox-ns.js', '/webbox/webbox-model.js', '/webbox/util.js', '/webbox/webbox-config.js'],    
    function(ns, models, util, config) {
	// updates the sync() method so that by default serializes
	// models to rdf
	// backbone-patch
	var oldSync = Backbone.sync;
	var endpoint = config.ENDPOINT;

	var contract_ns = function(prefixed) {
	    var pref = prefixed.split(':');
	    var pre = pref[0], pos = pref[1];
	    console.assert(ns[pre] !== undefined, "Could not find prefix " + pre);
	    return ns[pre] + pos;
	};
	var to_property = function(key) {
	    if (key.indexOf('http') == 0) { return $.rdf.resource(key); }
	    if (key.indexOf(':') >= 0)  {
		key = ns.expand_ns(key);
		return $.rdf.resource("<"+key+">");
	    }
	    console.log(" no prefix, ", "<"+ns.base + key+">");
	    return $.rdf.resource("<"+ns.base + key+">");
	};
	var is_resource = function(v) {
	    return typeof(v) == 'object' && v instanceof models.Model;
	};
	var to_literal_or_resource = function(v) {
	    if ( typeof(v) == 'number' ) { return $.rdf.literal(v); }
	    if ( typeof(v) == 'string' ) { /* todo: check ? */ return $.rdf.literal(v,{datatype:'xsd:string'}); } 
	    if ( is_resource(v) ) { return $.rdf.resource("<"+v.uri+">"); }
	    return $.rdf.literal(v);
	};

	var make_kb = function() {
	    return $.rdf.databank([], {base: ns.base, namespaces:ns.ns });
	};

	var serialize = function(model, deep, serialized_models) {
	    // serializes a single model; however, deep is true and v is a model,
	    // will serialize that too and return an object:
	    //   { u1 : --model_1_serialized--, u2 : ...  }
	    var base = model.base || model.get("_base") || ns.base;
	    var uri = model.url();
	    var uri_r = $.rdf.resource("<"+uri+">");
	    var data = model.toJSON();
	    var self = arguments.callee;
	    var triples = [];
	    var this_kb = make_kb();
	    
	    // make a place for us to store the models as they get serialized
	    serialized_models = (serialized_models !== undefined) ? serialized_models : {};
	    
	    _(data).keys().map(
		function(k) {
		    var v = data[k];
		    var k_r = to_property(k);
		    if ($.isArray(v)) {
			throw new Exception("Yo no arrays yet please");
		    } else {
			var v_r = to_literal_or_resource(v);
			var triple = $.rdf.triple(uri_r,k_r,v_r);
			this_kb.add(triple);
			if (deep && is_resource(v) && !(v.uri in serialized_models)) {
			    // then extend the set of serialized dudes to this model
			    _(serialized_models).extend(self(v, true, serialized_models));
			    log("serialized models is ", serialized_models);
			}
		    }
		});
	    console.log("setting serialized models ", uri);
	    serialized_models[uri] = this_kb.dump({format:'application/rdf+xml', serialize: true});
	    return deep ? serialized_models : serialized_models[uri];
	};	

	var put_update = function(uri, serialized_body) {
	    console.log("Asserting into graph ", uri + " --- " + (endpoint+"/data/"+uri));
	    return $.ajax({ type:"PUT", url: endpoint+"/data/"+uri, data:serialized_body, datatype:"text", headers:{ "Content-Type" : "application/rdf+xml" }});
	};

	var get_update = function(uri, model) {
	    var query = _("CONSTRUCT { ?s ?p ?o } WHERE { GRAPH \<<%= uri %>\> { ?s ?p ?o. } } LIMIT 100000").template({uri:uri});
	    var get = $.ajax({ type:"GET", url:endpoint+"/sparql/", data:{query:query}});
	    var d = new $.Deferred();
	    var kb = make_kb();
	    get.success(function(doc){
			    kb.load(doc, {});
			    var obj = {};
			    $.rdf({databank:kb}).where('<'+uri+'> ?p ?o').each(
				function() {
				    var prop = this.p.value.toString();

				    if (prop.indexOf(ns.base) == 0) {
					prop = prop.slice(ns.base.length);
				    }
				    var val = this.o.value;
				    console.log("prop ", prop, " val ", val);
				    obj[prop] = val;
				});
			    model.set(obj);
			}).error(function(x) { });	    
	    
	};
	
	Backbone.sync = function(method, model, options){
	    try { console.group('sync ' +  model.url());  } catch (x) {    }
	    log("method - ", method, " model ", model, model.url(), " - options: " , options);
	    var uri = model.url();
	    if (['create', 'update'].indexOf(method) >= 0) {
		// may return multiple models as a result, we want to serialize each one
		var serialized = {};
		serialize(model,true,serialized);
		console.log("SERIALIZED>> ", serialized);
		var ds = []; // deferreds
		_(serialized).keys().map(
		    function(uri) {
			console.log(" putting ", uri);
			ds.push(put_update(uri,serialized[uri]));
		    });
		return $.when.apply($,ds);
	    } else if (method == 'read') {
		return get_update(uri, model);
	    }
	    try { console.endGroup(); } catch (x) {   }
	};

	
    });