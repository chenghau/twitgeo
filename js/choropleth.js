

 function project (pos){
      var point= map.getViewPortPxFromLonLat(new OpenLayers.LonLat(pos[0], pos[1])
        .transform("EPSG:4326", "EPSG:900913"));
      return [point.x, point.y];
    }

var Choropleth = {
  mapd: MapD,
  svg: null,
  overlay: null,
  g: null,
  projection: null,
  data: null,
  path: null,
  feature: null,
  percents: false,
  source: "state",
  params: {
    request: "GroupByToken",
    sql: null,
    sort: "false",
    jointable: "state_data",
    joinvar: "name",
    joinattrs: "pst045212",
    //bbox: null,
    //stoptable: "",
    //tokens: [],
    k: 400 
  },
    
    

   init: function() {
     this.overlay = new OpenLayers.Layer.Vector("tweets");
     this.overlay.setZIndex(0);
     this.overlay.afterAdd = $.proxy(function() {
      var div = d3.selectAll("#" + this.overlay.div.id);
      div.selectAll("svg").remove();
      this.svg = div.append("svg").attr("class", "happy");
      this.g = this.svg.append("g");
      this.path = d3.geo.path().projection(project);
      this.colorScale = d3.scale.quantize().range(["rgb(255,255,229)","rgb(255,247,188)", "rgb(254,227,145)", "rgb(254,196,79)", "rgb(254,153,41)", "rgb(236,112,20)", "rgb(204,76,2)", "rgb(140,45,4)"]);
      /*this.colorScale = d3.scale.quantize()
                         .range(["rgb(237,248,233)", "rgb(186,228,179)",
                          "rgb(116,196,118)", "rgb(49,163,84)","rgb(0,109,44)"]);*/
      this.reset();

     }, this);
     map.addLayer(this.overlay);
     map.events.register("moveend", map, $.proxy(this.reset,this));
     this.addGeoData();

    },
  
   getUrl: function() {
      var numQueryTerms = this.mapd.queryTerms.length;
      var query = this.mapd.getWhere(options);
      var options = {};
      if (numQueryTerms > 0) {
        options = {splitQuery: true};
      }
      var query = this.mapd.getWhere(options);

      this.params.sql = "select " + this.source;

      if (numQueryTerms > 0) {
          this.params.sql += "," + query[0] + " from " + this.mapd.table + query[1]; 
          this.percents = true;
      }
      else {
          this.params.sql += " from " + this.mapd.table + query; 
          this.percents = false;
      }
   
      //this.params.bbox = this.mapd.map.getExtent().toBBOX();
      var url = this.mapd.host + '?' + buildURI(this.params);
      return url;
    },
          
    reload: function(options) {
      $.getJSON(this.getUrl(options)).done($.proxy(this.onLoad, this));
    },
    
    onLoad: function(dataset) {
      //console.log(dataset);
      this.data = dataset.results;
      /*
      if ('percents' in dataset) {
      this.data = $.map(dataset.tokens, function(e1, idx) {
          if (e1 != "") 
              return {"label": e1, "val":dataset.percents[idx] < -0.8 ? null : dataset.percents[idx]};
      });
    }
    else if ('zScores' in dataset) {
      this.data = $.map(dataset.tokens, function(e1, idx) {
          if (e1 != "") 
              return {"label": e1, "val":dataset.zScores[idx]};
      });
    }
    else {
      this.data = $.map(dataset.tokens, function(e1, idx) {
          if (e1 != "") 
              return {"label": e1, "val":dataset.counts[idx]};
      });
    }
     */

      var g = this.g;
      var data = this.data;
      var numVals = data.length;
      if (this.percents == false) {
        for (var i = 0; i < numVals; i++)
            data[i].y /= data[i].pst045212;
      }

      this.colorScale.domain([
        d3.min(this.data, function(d) {return d.y}),
        d3.max(this.data, function(d) {return d.y})
      ]);


      var colorScale = this.colorScale;
      this.feature = g.selectAll("path")
        .style("fill", function(d) {
            var abbr = d.properties.abbr;
            //console.log(abbr);
            var joined = false;
                for (var i = 0; i < numVals; i++) {
                    if (data[i].label == abbr) {
                        //console.log(data[i].y);
                        if (data[i].y == null)
                            return "#33b"; 
                        else { 
                                return(colorScale(data[i].y));
                        }
                    }
                }
                return "#33b";
            //console.log(d.name);
        });

      //for (var i = 0; i < numVals; i++) {
        
      
      
    },

   addGeoData: function() {
      var path = this.path;
      var g = this.g;
      d3.json("data/us_states.json", function(error,json) {
        Choropleth.feature = g.selectAll("path")
          .data(json.features)
          .enter().append("path")
          .attr("d",path)
          .style("opacity", 0.7)
          .style("fill", "#4684B5");
        //Choropleth.feature = g.append("path")
        //  .datum(topojson.mesh(us))
        //  .attr("d", path);
      });
   },

   reset: function() {
     var size = map.getSize();
     console.log("size: ");
     console.log(size);

     this.svg.attr("width", size.w)
       .attr("height", size.h);
     
     if (this.feature != null) {
      console.log("not null");
      this.feature.attr("d", this.path);
    }


     /*
     if (this.data != null) {
       var g = this.g;
       var data = this.data;
       g.selectAll("circle")
         .data(data)
         .attr("cx",function(d){
            return project([d.x, d.y])[0];
          })
         .attr("cy",function(d){
            return project([d.x, d.y])[1];
          });
      }
      */
   }
}
    


    
