// Events:
// heatmapreload:    tell HeatMap to reload
// geocodeend:       geocoding service is ready

var BBOX = {
  WORLD: "-19313026.92,-6523983.06,14187182.33,12002425.38",
  US: "-13888497.96,2817023.96,-7450902.94,6340356.62"
};

function buildURI(params) {
  var uri = '';
  for (key in params) 
    uri += key + '=' + params[key] + '&';
  return encodeURI(uri.substring(0, uri.length - 1));
};

var MapD = {
  map: null,
  //host: "http://192.168.1.90:8080/",
  host: "http://www.velocidy.net:7000/",
  table: "tweets",
//  timestart: (new Date('4/15/2013 12:00:00 AM GMT-0400').getTime()/1000).toFixed(0),
//  timeend: (new Date('4/16/2013 12:00:00 AM GMT-0400').getTime()/1000).toFixed(0),
  timestart: null,
  timeend: null,
  queryTerms: [],
  user: null,
  datastart: null,
  dataend: null,
  services: {
    pointmap: null,
    heatmap: null,
    geotrends: null,
    topktokens: null, 
    tweets: null,
    graph: null,
    search: null
  },

  init: function(map, pointmap, heatmap, geotrends, topktokens, tweets, graph, search) {
    if (window.location.search == "?local")
        this.host = "http://sirubu.velocidy.net:8080";
      
    this.map = map;
    this.services.pointmap = pointmap;
    this.services.heatmap = heatmap;
    this.services.geotrends = geotrends;
    this.services.topktokens = topktokens;
    this.services.tweets = tweets;
    this.services.graph = graph;
    this.services.search = search;
    this.map.events.register('moveend', this, this.reload);
    $(document).on('mapdreload', $.proxy(this.reload, this));
  },

  start: function() {
    $.getJSON(this.services.tweets.getTimeRangeURL()).done($.proxy(this.setDataTimeRange, this));
  },

  startCheck: function() {
    if (this.datastart != null && this.dataend != null) {
      this.timestart = this.datastart;
      this.timeend = this.dataend;
      this.reload();
    }
  },

  reload: function() {
    console.log('in reload');
    this.services.geotrends.reload();
    this.services.topktokens.reload();
    this.services.tweets.reload();
    this.services.graph.reload();
  },

  reloadByGraph: function(start, end) {
    console.log('in reloadByGraph');
    var oldStart = this.timestart;
    var oldEnd = this.timeend;
    this.timestart = start;
    this.timeend = end;
    this.services.geotrends.reload();
    this.services.topktokens.reload();
    this.services.tweets.reload();
    this.services.pointmap.reload();
    this.services.heatmap.reload();
    this.timestart = oldStart;
    this.timeend = oldEnd;
  },

  setDataStart: function(json) {
    this.datastart = json.results[0].time;
    this.startCheck();
  },

  setDataEnd: function(json) {
    this.dataend = json.results[0].time;
    this.startCheck();
  },


  setDataTimeRange: function(json) {
    this.datastart = json.results[0].min;
    this.dataend = json.results[0].max;
    this.startCheck();
  },


  setUser: function(user) {
    this.user = user;
  },

  setQueryTerms: function(queryTerms) {
    this.queryTerms = queryTerms.trim().split(" ").filter(function(d) {return d});
  },

  parseQueryTerms: function(queryTerms) { 
    var array = queryTerms.slice(0);
    for (i in array) {
      array[i] = "'" + array[i] + "'";
    }
    var whereTerms = array.join(" and tweet_text ilike ");
    whereTerms = "(tweet_text ilike " + whereTerms + ") ";
    return whereTerms;
  },

  getWhere: function(options) {
    var where = "";
    var timestart = this.timestart;
    var timeend = this.timeend;
    var user = this.user;
    console.log("user 1: " + user);
    var queryTerms = this.queryTerms;
    if (options) {
      if (options.time) {
        timestart = options.time.timestart;
        timeend = options.time.timeend;
      }
      if ("queryTerms" in options)
        queryTerms = options.queryTerms;
      if ("user" in options) {
        user = options.user;
        console.log("user 2: " + user);
      }
    }

    if (timestart)
      where += "time >= " + timestart + " and ";
    if (timeend)
      where += "time <= " + timeend + " and ";
    if (queryTerms.length) {
      queryTerms = this.parseQueryTerms(queryTerms);
      where += queryTerms + " and ";
    }
    if (user)
      where += "sender_name ilike '" + user + "' and ";
    if (where)
      where = " where " + where.substr(0, where.length-5);
    console.log(where);
    return where;
  },
};

var GeoTrends = {
  mapd: MapD,
  binWidthPx: 96,
  binHeightPx: 96,
  params: {
    request: "GetGeoTrends",
    sql: null,
    bbox: null,
    timestart: null,
    timeend: null,
    xbins: 16,
    ybins: 16,
    tbins: 2,
    stoptable: "long_stop"
  },
  GRIDSIZE_SMALL: 64,
  GRIDSIZE_MEDIUM: 96,
  GRIDSIZE_LARGE: 128,

  getGridSize: function() {
    var size = [this.binWidthPx, this.binHeightPx]
    return size;
  },

  setGridSize: function(size) {
    this.binWidthPx = size;
    this.binHeightPx = size;
  },

  alignBBOX: function() {
    var map = this.mapd.map;
    var bbox = map.getExtent().toBBOX().split(',');
    var viewPortSize = map.getSize(); // in pixels
    var resolution = map.getResolution(); // meters per pixel
    var binWidth = this.binWidthPx * resolution;
    var binHeight = this.binHeightPx * resolution;
    var bboxLeft = Math.floor(bbox[0] / binWidth) * binWidth;
    var bboxRight = Math.ceil(bbox[2] / binWidth) * binWidth;
    var bboxBottom = Math.floor(bbox[1] / binWidth) * binHeight;
    var bboxTop = Math.ceil(bbox[3] / binWidth) * binHeight;
    this.params.bbox = [bboxLeft, bboxBottom, bboxRight, bboxTop].join();
    this.params.xbins = Math.round((bboxRight - bboxLeft) / binWidth);
    this.params.ybins = Math.round((bboxTop - bboxBottom) / binHeight);
  },

  getURL: function() {
    this.params.sql = "select goog_x, goog_y, time, tweet_text from " + this.mapd.table;
    this.params.sql += this.mapd.getWhere();
    this.params.timestart = this.mapd.timestart;
    this.params.timeend = this.mapd.timeend;
    this.alignBBOX();
    var url = this.mapd.host + '?' + buildURI(this.params);
    return url;
  },

  reload: function() {
    //$.getJSON(this.getURL()).done($.proxy(onTrends, this, this.mapd.queryTerms));
  } 
};

var TopKTokens = {
  mapd: MapD,
  cloudDiv: null, 
  defaultK: 30,
  params: {
    request: "GetTopKTokens",
    sql: null,
    bbox: null,
    k: 30,
    stoptable: "long_stop"
  },

  init: function(cloudDiv) {
    this.cloudDiv = cloudDiv;
    $(this.cloudDiv).on("click", $.proxy(this.addClickedWord, this)); 
  },

  getURL: function() {
    this.params.sql = "select tweet_text from " + this.mapd.table;
    this.params.sql += this.mapd.getWhere();
    var numQueryTerms = this.mapd.queryTerms.length;
    this.params.k = this.defaultK + numQueryTerms;
    this.params.bbox = this.mapd.map.getExtent().toBBOX();
    var url = this.mapd.host + '?' + buildURI(this.params);
    return url;
  },
  addClickedWord: function(event) {
    var token = event.originalEvent.srcElement.innerText;
    console.log("circle cloud token: " + token);
    if (token == event.originalEvent.srcElement.innerHTML) {
      console.log(this.mapd);
      this.mapd.services.search.termsInput.val(this.mapd.services.search.termsInput.val() + " " + token);
      this.mapd.services.search.form.submit();


      //to make sure we're actually clicking on word
      console.log(token);
    }
  },

  reload: function() {
    //$.getJSON(this.getURL()).done(function(json) {console.log(json)});
    $.getJSON(this.getURL()).done($.proxy(this.onLoad, this));
  },
  onLoad: function(json) {
    this.cloudDiv.empty();

    var tokens = json.tokens; 
    var counts = json.counts; 
    var n =json.n;
    var numTokens = tokens.length;
    var numQueryTerms = this.mapd.queryTerms.length;
    var wordArray = new Array(numTokens - numQueryTerms);
    var percentFactor = 100.0 / n;
    console.log("numqueryterms");
    console.log(numQueryTerms);
    var tokenRatio = 1.0 / counts[2 + numQueryTerms];
    $('#numTokensText').text("# Tokens: " + numberWithCommas(n));
    for (var t = numQueryTerms; t < numTokens; t++) {
      //$('<li>' + tokens[i] + '</li>').appendTo(cloud);
        var percent = counts[t] * percentFactor;
        var textPercent = "%" + percent.toFixed(3);
        wordArray[t - numQueryTerms] = {text: tokens[t], html: {title: textPercent},  weight: Math.max(Math.min(40, Math.round(counts[t]* tokenRatio * 30.0)), 4)};
    }
    console.log(wordArray);
    this.cloudDiv.jQCloud(wordArray);
    console.log("clouddiv");
    console.log(this.cloudDiv);
  }



};

var PointMap = {
  mapd: MapD,
  wms: null,
  params: {
    request: "GetMap",
    sql: null,
    bbox: null,
    width: null,
    height: null,
    layers: "point",
    r: 0,
    g: 0,
    b: 100,
    radius: 1,
    format: "image/png",
    transparent: true
  },

  init: function(wms) {
    this.wms = wms;
    this.wms.events.register('retile', this, this.setWMSParams);
    $(document).on('pointmapreload', $.proxy(this.reload, this));
  },

  setWMSParams: function() {
    this.wms.params = OpenLayers.Util.extend(this.wms.params, this.getParams());
  },

  getParams: function() {
    this.params.sql = "select goog_x, goog_y, tweet_text from " + this.mapd.table;
    this.params.sql += this.mapd.getWhere();
    return this.params;
  },

  reload: function() {
    this.wms.mergeNewParams(this.getParams());
  }
};

var HeatMap = {
  mapd: MapD,
  wms: null,
  params: {
    request: "GetMap",
    sql: null,
    bbox: null,
    width: null,
    height: null,
    layers: "heatmap",
    maxval: "auto", 
    format: "image/png",
    transparent: true
  },

  init: function(wms) {
    this.wms = wms;
    this.wms.events.register('retile', this, this.setWMSParams);
    $(document).on('heatmapreload', $.proxy(this.reload, this));
  },

  setWMSParams: function() {
    this.wms.params = OpenLayers.Util.extend(this.wms.params, this.getParams());
  },

  getParams: function() {
    this.params.sql = "select goog_x, goog_y from " + this.mapd.table;
    this.params.sql += this.mapd.getWhere();
    return this.params;
  },

  reload: function() {
    this.wms.mergeNewParams(this.getParams());
  }
};

/*
var GetNearestTweet = {
  mapd: MapD,
*/
    

var Tweets = 
{
  mapd: MapD,
  sortDiv: null,  
  viewDiv: null,
  params: {
    request: "GetFeatureInfo",
    sql: null,
    bbox: null,
  },
  defaultPointStyle: null,
  tempPointStyle: null,
  pointStyleMap: null,
  mouseOverFeatureControl: null,
  selectFeatureControl: null,
  sortDesc: null,

  init: function(sortDiv, viewDiv) {
    console.log("SortDiv: " + sortDiv);
    console.log(viewDiv);
    this.sortDiv = sortDiv;
    this.viewDiv = viewDiv;
    this.defaultPointStyle = new OpenLayers.Style({
    'fillColor': '#C00',
    'fillOpacity': 0.0,
    //'strokeColor': '#000',
    'strokeWidth': 0,
    'pointRadius': 0 
    });
    this.tempPointStyle = new OpenLayers.Style({
    'fillColor': '#C00',
    'externalGraphic': 'img/twitter-bird.png', 
    'strokeColor': '#000',
    'fillOpacity': 1.0,
    'strokeWidth': 1,
    'pointRadius': 20 
    });

    this.selectedPointStyle = new OpenLayers.Style({
      graphicName: "star",
      pointRadius: 10,
      fillOpacity: 1.0,
      strokeColor: "#000",
      fillColor: '${selectColor}'
    });
    
    this.pointStyleMap = new OpenLayers.StyleMap({
    'default': this.defaultPointStyle,
    'temporary': this.tempPointStyle,
    'select': this.selectedPointStyle
    });

    this.sortDesc = true;

    $("<div id='sortPref'>Sort by <a href='javascript:void(0)' id='oldSort'>Oldest</a> <a href='javascript:void(0)' id='newSort'>Newest</a></div>").appendTo(this.sortDiv);
    $('#oldSort').click($.proxy(this.oldSortFunc, this));
    $('#newSort').click($.proxy(this.newSortFunc, this));
    

  },
  oldSortFunc: function () { 
    if (this.sortDesc == true) {
        this.sortDesc = false;
        this.reload();
        $(this.viewDiv).scrollTop(0);
        
      }
   },
   newSortFunc: function () { 
      if (this.sortDesc == false) {
        this.sortDesc = true;
        this.reload();
        $(this.viewDiv).scrollTop(0);
      }
   },

  getTimeRangeURL: function() {
    this.params.sql = "select min(time), max(time) from " + this.mapd.table;
    this.params.bbox = this.mapd.map.getExtent().toBBOX();
    var url = this.mapd.host + '?' + buildURI(this.params);
    return url;
  },

  getURL: function(options) {
    this.params.sql = "select goog_x, goog_y, time, sender_name, tweet_text from " + this.mapd.table;
    this.params.sql += this.mapd.getWhere(options);
    this.params.sql += " order by time " + (this.sortDesc == true ? "desc" : "") +  " limit 100";
    this.params.bbox = this.mapd.map.getExtent().toBBOX();
    var url = this.mapd.host + '?' + buildURI(this.params);
    return url;
  },

  reload: function() {
    $.getJSON(this.getURL()).done($.proxy(this.onTweets, this));
  },
  //oldSortFunc :function () { 
  //    console.log("oldsort");
  //    if (this.sortDesc == true) {
  //      console.log ("old sorting");
  //      this.sortDesc = false;
  //      this.reload();
  //    }
  // },
   
  onTweets: function(json) {
    console.log('in onTweets');
    this.viewDiv.empty();
    if (this.sortDesc) {
      $("#newSort").addClass("link-visited");
      $("#oldSort").removeClass("link-visited");
    }
    else {
      $("#oldSort").addClass("link-visited");
      $("#newSort").removeClass("link-visited");
    }

    //$('#oldSort').click($.proxy(this.oldSortFunc, this));
    var container = $('').appendTo(this.viewDiv);

    if (json == null) return;
    if (vectors) map.removeLayer(vectors);
    vectors = new OpenLayers.Layer.Vector("Vector Layer");
    vectors.styleMap = this.pointStyleMap;
    this.mouseOverFeatureControl = new OpenLayers.Control.SelectFeature (vectors, 
      { hover: false,
        renderIntent: "temporary"
        /* eventListeners: { 
          featurehighlighted: this.onPointHover,
          featureunhighlighted: this.offPointHover
      }
      */
    });
    map.addControl(this.mouseOverFeatureControl);
    this.mouseOverFeatureControl.activate();

    this.selectFeatureControl = new OpenLayers.Control.SelectFeature (vectors, 
      {
        //renderIntent: "select"
      });

    map.addControl(this.selectFeatureControl);
    this.selectFeatureControl.activate();

    map.addLayer(vectors);
    vectors.setZIndex(Number(pointLayer.getZIndex()) + 1);
    if (markers) map.removeLayer(markers);
    markers = new OpenLayers.Layer.Markers("Markers Layer");
    map.addLayer(markers);
    markers.setZIndex(Number(vectors.getZIndex()) + 1);

    var results = json.results;
    for (i in results)
    {
      var result = results[i];
      if (!result || !result.tweet_text)
        continue;
      this.add(result, i);
    }
  },

  add: function(tweet, index) {
    var user = tweet.sender_name;
    var text = tweet.tweet_text;
    //tweet.time = tweet.time - 4 * 60 * 60; // hack: original data set is ahead by 4 hours.
    var time = new Date(tweet.time * 1000);
    var x = tweet.goog_x;
    var y = tweet.goog_y;
    
    var container = $('<li></li>').addClass("tweet-container").appendTo(this.viewDiv);
    var header = $('<div></div>').addClass("tweet-header").appendTo(container);
    var content = $('<p></p>').addClass("tweet-content").appendTo(container);
    var profile = $('<a></a>').addClass("tweet-profile").appendTo(header);
    var timeText = $('<div></div>').addClass("tweet-time").appendTo(header);
    timeText.html(time.toLocaleString());
    content.html(twttr.txt.autoLink(text));
    profile.html(user);
    profile.attr('href', 'https://twitter.com/' + user);

    var urls = twttr.txt.extractUrls(text);
    var hashtags = twttr.txt.extractHashtags(text);
    var users = twttr.txt.extractMentions(text);
    var selectColor = this.getRandomColor(); 
    container.data({tweet: tweet, urls: urls, hashtags: hashtags, users: users, selectColor: selectColor});
    container.mouseenter($.proxy(this.onMouseEnter,this, container));
    container.mouseleave($.proxy(this.onMouseLeave,this, container));
    container.click($.proxy(this.onClick,this,container));
    //container.mouseup($.proxy(this.onUnClick,this,container));
    this.addPoint(x,y,index, selectColor);

  },
 

  onPointHover: function(e) {
    $(".tweet-container").eq(e.feature.data.index).addClass("container-hover");
    //$(".tweet-container").eq(e.feature.data.index).addClass("tweet-container > hover");
  },
  offPointHover: function(e) {
      $(".tweet-container").eq(e.feature.data.index).removeClass("container-hover");
  },

  addPopup: function(x, y, html) {
    var popupLatLon = new OpenLayers.LonLat(x, y);
    var popupSize = new OpenLayers.Size(50, 50);
    var popup = new OpenLayers.Popup.Anchored(null, popupLatLon, popupSize, html);
    this.mapd.map.addPopup(popup);
    popup.updateSize();
    console.log(popup);
  },

  addPoint: function(x,y,index, selectColor) {
    var point = new OpenLayers.Geometry.Point(x,y);
    var featurePoint = new OpenLayers.Feature.Vector(point, {index: index, selectColor: selectColor});
    vectors.addFeatures([featurePoint]);
  }, 

  getRandomColor: function() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ )
      color += letters[Math.round(Math.random() * 15)];
      return color;
  },

  onClick: function(container) {
    var index = $(container).index();
    if (OpenLayers.Util.indexOf(vectors.selectedFeatures,vectors.features[index]) == -1)
      this.selectFeatureControl.select(vectors.features[index]);
    else
      this.selectFeatureControl.unselect(vectors.features[index]);
  },

  // this points to <li> container 
  onMouseEnter: function(container) {
    console.log(this);
    var index = $(container).index();
    this.mouseOverFeatureControl.highlight(vectors.features[index]);
    /*
    var tweet = $(container).data('tweet');
    console.log(tweet);
    var user = tweet.sender_name;
    var x = tweet.goog_x;
    var y = tweet.goog_y;
    var label = new OpenLayers.Label(x, y, user, null, null, null);
    label.addTo(markers);
    $(label.getIcon()).addClass('label-user');
    $(container).data('label', label);
    */
  },

  // this points to <li> container 
  onMouseLeave: function(container) {
    var index = $(container).index();
    //if (OpenLayers.Util.indexOf(vectors.selectedFeatures,vectors.features[index]) == -1)
    if (OpenLayers.Util.indexOf(vectors.selectedFeatures,vectors.features[index]) == -1)
      this.mouseOverFeatureControl.unhighlight(vectors.features[index]);
    else {
      // need to reselect element
      this.selectFeatureControl.select(vectors.features[index]);
    }
    //$(container).data('label').erase();
  },
};

var GeoCoder = {
  map: null,
  _geocoder: new google.maps.Geocoder(),
  address: null,
  status: null,

  setMap: function(map) {
    this.map = map;
  },

  geocode: function(address) {
    this.address = address;
    this._geocoder.geocode({'address': address}, $.proxy(this.onGeoCoding, this));
  },

  onGeoCoding: function(data, status) {
    console.log('in onGeoCoding');
    this.status = status;
    if (status != google.maps.GeocoderStatus.OK) {
      this.bbox = null;
      console.log('Geocoding service failed:', status);
      return;
    }
    if (data.length != 1)  {
      console.log('Geocoding service returned', data.length);
    }
    var viewport = data[0].geometry.viewport;
    var ne = viewport.getNorthEast();
    var sw = viewport.getSouthWest();
    var bounds = new OpenLayers.Bounds(sw.lng(), sw.lat(), ne.lng(), ne.lat());
    var proj = new OpenLayers.Projection("EPSG:4326");
    bounds.transform(proj, this.map.getProjectionObject());
    $(document).trigger({type: 'geocodeend', bounds: bounds});
  }
}

var Search = {
  geocoder: GeoCoder,
  mapd: MapD,
  map: null,
  form: null,
  termsInput: null,
  userInput: null,
  locationInput: null,
  terms: '',
  user: '',
  location: '',
  locationChanged: false,
  io: null,

  init: function(map, form, termsInput, userInput, locationInput) {
    $(document).on('propertychange keyup input paste', 'input.search-input', function() {
      var io = $(this).val().length ? 1: 0;
      $(this).next('.iconClear').stop().fadeTo(300,io);
      }).on('click', '.iconClear', function() {
          $(this).delay(300).fadeTo(300,0).prev('input').val('');
          Search.form.submit();
          });

    this.map = map;
    this.form = form;
    this.termsInput = termsInput;
    this.userInput = userInput;
    this.locationInput = locationInput;
    this.geocoder.setMap(this.map);
    this.form.submit($.proxy(this.onSearch, this));
    $(document).on('geocodeend', $.proxy(this.onGeoCodeEnd, this));
    this.map.events.register('moveend', this, this.onMapMove);
  },
 
  onSearch: function() {
    console.log('in onSearch');
    var terms = this.termsInput.val();
    var location = this.locationInput.val();
    this.locationChanged = this.location != location;
    this.terms = terms;
    this.user = this.userInput.val();
    this.mapd.setQueryTerms(this.terms);
    this.mapd.setUser(this.user);

    if (this.locationChanged) {
      this.location = location;
      this.geocoder.geocode(this.location);
      return false;
    }
    $(document).trigger({type: 'mapdreload'});
    $(document).trigger({type: 'pointmapreload'});
    $(document).trigger({type: 'heatmapreload'});
    return false;
  },

  onGeoCodeEnd: function(event) {
    console.log('in onGeoCodeEnd');
    var bounds = event.bounds;
    this.map.zoomToExtent(bounds);
  },

  onMapMove: function() 
  {
    console.log('in onMapMove');
    if (this.locationChanged)
      this.locationChanged = false;
    else {
      this.location = "";
      this.locationInput.val("");
    }
  },
}

var Settings = {
  geotrends: GeoTrends,
  gridSmall: null,
  gridMedium: null,
  gridLarge: null,

  init: function(gridSmall, gridMedium, gridLarge) {
    this.gridSmall = gridSmall;
    this.gridMedium = gridMedium;
    this.gridLarge = gridLarge;
    this.gridSmall.click(this.geotrends.GRIDSIZE_SMALL, $.proxy(this.onChangeGridSize, this));
    this.gridMedium.click(this.geotrends.GRIDSIZE_MEDIUM, $.proxy(this.onChangeGridSize, this));
    this.gridLarge.click(this.geotrends.GRIDSIZE_LARGE, $.proxy(this.onChangeGridSize, this));
  },

  onChangeGridSize: function(event) {
    console.log('in onChangeGridSize');
    var size = event.data;
    var currentGridSize = this.geotrends.getGridSize();
    if (size != currentGridSize[0]) {
      this.geotrends.setGridSize(size);
      this.geotrends.reload();
    }
  }
}

var Chart = 
{
  mapd: MapD,
  chart: LineChart,
  viewDiv: null,
  seriesId: 0,
  queryTerms: [],
  params: {
    request: "Graph",
    sql: null,
    bbox: null,
    histstart: null,
    histend: null,
    histbins: 100
  },

  init: function(viewDiv) {
    this.viewDiv = viewDiv;
    this.chart.init(d3.select(this.viewDiv.get(0)), $.proxy(this.onZoom, this), $.proxy(this.onCompare, this));
  },

  getWhere: function(options) {
    return this.mapd.getWhere(options);
  },
  
  getURL: function(options) {
    this.params.sql = "select time from " + this.mapd.table;
    this.params.sql += this.getWhere(options);
    this.params.histstart = this.mapd.timestart > this.mapd.datastart? this.mapd.timestart : this.mapd.datastart;
    this.params.histend = this.mapd.timeend < this.mapd.dataend? this.mapd.timeend : this.mapd.dataend;
    if (options && options.time) {
      this.params.histstart = options.time.timestart;
      this.params.histend = options.time.timeend;
    }
    this.params.bbox = this.mapd.map.getExtent().toBBOX();
    var url = this.mapd.host + '?' + buildURI(this.params);
    return url;
  },

  reload: function() {
    var queryTerms = this.queryTerms.slice(0);
    // for now, time range always corresponds to entire data range
    var options = {queryTerms: this.mapd.queryTerms, user: this.mapd.user, time: {timestart: this.mapd.datastart, timeend: this.mapd.dataend }};
    $.getJSON(this.getURL(options)).done($.proxy(this.onChart, this, this.mapd.queryTerms, true));
  },

  drawChart: function() {
    console.log('in drawChart', this);
  },

  onChart: function(queryTerms, clear, json) {
    console.log('in onChart', queryTerms);
    queryTerms = queryTerms.join(" ")
    if (clear) {
      this.seriesId = 0;
      this.queryTerms = [];
      this.chart.removeAll();
    }
    this.queryTerms.push(queryTerms);
    var series = [];
    for (i in json.x) {
      var time  = json.x[i];
      time = time - 4 * 60 * 60; // hack: original data set is ahead by 4 hours.
      var count = json.count[i];
      series.push({date: new Date(time * 1000), value: count});
    }
    this.chart.addSeries(this.seriesId, queryTerms, series);
    this.seriesId += 1;
  },

  onZoom: function() {
    console.log('in onZoom');
    var range = this.chart.getXRange();
    var start = (range[0].getTime()/1000).toFixed(0);
    var end = (range[1].getTime()/1000).toFixed(0)
    start = +start + 4 * 60 * 60; // hack: original data set is ahead by 4 hours.
    end = +end + 4 * 60 * 60; // hack: original data set is ahead by 4 hours.
    console.log(range, start, end);
    this.mapd.reloadByGraph(start, end);
  },

  onCompare: function(terms) {
    console.log('in onCompare');
    var queryTerms = terms.trim().split(" ").filter(function(d) {return d});
    // for now, time range always corresponds to entire data range
    var options = {queryTerms: queryTerms, user: this.mapd.user,  time: {timestart: this.mapd.datastart, timeend: this.mapd.dataend }};
    $.getJSON(this.getURL(options)).done($.proxy(this.onChart, this, queryTerms, false));
  }
}
