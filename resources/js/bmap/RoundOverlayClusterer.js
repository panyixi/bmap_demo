/**
 * @fileoverview RoundOverlayClusterer自定义覆盖物聚合器，用来解决加载大量自定义覆盖物要素到地图上产生覆盖现象的问题，并提高性能。
 * 基于Baidu Map API 1.2.
 * 仿照MarkerClusterer编写。
 * 
 * @author panyixi 
 * @version 1.2
 */


/**
 * @namespace BMap的所有library类均放在BMapLib命名空间下
 */
var BMapLib = window.BMapLib = BMapLib || {};   //如果发现没有这个对象,就自动创建new Object(),如果有,就直接使用这个对象,这样就不会覆盖
(function(){

	/**
	 * 获取一个扩展的视图范围，把上下左右都扩大一样的像素值。
	 * @param {Map} map BMap.Map的实例化对象
	 * @param {BMap.Bounds} bounds BMap.Bounds的实例化对象，即网格初始化
	 * @param {Number} gridSize 要扩大的像素值
	 *
	 * @return {BMap.Bounds} 返回扩大后的视图范围。
	 */
	var getExtendedBounds = function(map, bounds, gridSize){
		bounds = cutBoundsInRange(bounds);
		var pixelNE = map.pointToPixel(bounds.getNorthEast());  //经纬度坐标转换为像素坐标
		var pixelSW = map.pointToPixel(bounds.getSouthWest()); 
		pixelNE.x += gridSize;
		pixelNE.y -= gridSize;
		pixelSW.x -= gridSize;
		pixelSW.y += gridSize;
		var newNE = map.pixelToPoint(pixelNE);
		var newSW = map.pixelToPoint(pixelSW);
		return new BMap.Bounds(newSW, newNE);
	};

	/**
	 * 按照百度地图支持的世界范围对bounds进行边界处理
	 * @param {BMap.Bounds} bounds BMap.Bounds的实例化对象
	 *
	 * @return {BMap.Bounds} 返回不越界的视图范围
	 */
	var cutBoundsInRange = function (bounds) {
		var maxX = getRange(bounds.getNorthEast().lng, -180, 180);
		var minX = getRange(bounds.getSouthWest().lng, -180, 180);
		var maxY = getRange(bounds.getNorthEast().lat, -74, 74);
		var minY = getRange(bounds.getSouthWest().lat, -74, 74);
		return new BMap.Bounds(new BMap.Point(minX, minY), new BMap.Point(maxX, maxY));
	};

	/**
	 * 对单个值进行边界处理。
	 * @param {Number} i 要处理的数值
	 * @param {Number} min 下边界值
	 * @param {Number} max 上边界值
	 * 
	 * @return {Number} 返回不越界的数值
	 */
	var getRange = function (i, mix, max) {
		mix && (i = Math.max(i, mix));  //a && b:如果执行a后返回true，则执行b并返回b的值；如果执行a后返回false，则整个表达式返回a的值，b不执行；
		max && (i = Math.min(i, max));
		return i;
	};

	/**
	 * 判断给定的对象是否为数组
	 * @param {Object} source 要测试的对象
	 *
	 * @return {Boolean} 如果是数组返回true，否则返回false
	 */
	var isArray = function (source) {
		return '[object Array]' === Object.prototype.toString.call(source);
	};

	/**
	 * 返回item在source中的索引位置
	 * @param {Object} item 要测试的对象
	 * @param {Array} source 数组
	 *
	 * @return {Number} 如果在数组内，返回索引，否则返回-1
	 */
	var indexOf = function(item, source){
		var index = -1;
		if(isArray(source)){
			if (source.indexOf) {
				index = source.indexOf(item);
			} else {
				for (var i = 0, m; m = source[i]; i++) {
					if (m === item) {
						index = i;
						break;
					}
				}
			}
		}        
		return index;
	};

	/**
	 *@exports RoundOverlayClusterer as BMapLib.RoundOverlayClusterer
	 */
	var RoundOverlayClusterer =  
		/**
		 * RoundOverlayClusterer
		 * @class 用来解决加载大量点要素到地图上产生覆盖现象的问题，并提高性能
		 * @constructor
		 * @param {Map} map 地图的一个实例。
		 * @param {Json Object} options 可选参数，可选项包括：<br />
		 *    roundOverlays {Array<RoundOverlay>} 要聚合的自定义覆盖物数组<br />
		 *    girdSize {Number} 聚合计算时网格的像素大小，默认60<br />
		 *    maxZoom {Number} 最大的聚合级别，大于该级别就不进行相应的聚合<br />
		 *    minClusterSize {Number} 最小的聚合数量，小于该数量的不能成为一个聚合，默认为2<br />
		 *    isAverangeCenter {Boolean} 聚合点的落脚位置是否是所有聚合在内点的平均值，默认为否，落脚在聚合内的第一个点<br />
		 *    styles {Array<IconStyle>} 自定义聚合后的图标风格，请参考TextIconOverlay类<br />
		 */
		BMapLib.RoundOverlayClusterer = function(map, options){
		if (!map){
			return;
		}
		this._map = map;
		this._roundOverlays = [];
		this._clusters = [];

		var opts = options || {};
		this._gridSize = opts["gridSize"] || 60;
		this._maxZoom = opts["maxZoom"] || 18;
		this._minClusterSize = opts["minClusterSize"] || 2;           
		this._isAverageCenter = false;
		if (opts['isAverageCenter'] != undefined) {
			this._isAverageCenter = opts['isAverageCenter'];
		}    
		this._styles = opts["styles"] || [];

		var that = this;
		this._map.addEventListener("zoomend",function(){
			if(tempInfoBox){
				tempInfoBox.close();
			}
			that._redraw();     
		});

		this._map.addEventListener("moveend",function(){
			if(tempInfoBox){
				tempInfoBox.close();
			}
			that._redraw();     
		});

		var rols = opts["roundOverlays"];
		isArray(rols) && this.addRoundOverlays(rols);
	};

	/**
	 * 添加要聚合的覆盖物数组。
	 * @param {Array<RoundOverlay>} roundOverlays 要聚合的覆盖物数组
	 *
	 * @return 无返回值。
	 */
	RoundOverlayClusterer.prototype.addRoundOverlays = function(roundOverlays){
		for(var i = 0, len = roundOverlays.length; i < len ; i++){
			this._pushRoundOverlayTo(roundOverlays[i]);
		}
		this._createClusters();   
	};

	/**
	 * 把一个覆盖物添加到要聚合的覆盖物数组中
	 * @param {BMap.RoundOverlay} roundOverlay 要添加的覆盖物
	 *
	 * @return 无返回值。
	 */
	RoundOverlayClusterer.prototype._pushRoundOverlayTo = function(roundOverlay){
		var index = indexOf(roundOverlay, this._roundOverlays);
		if(index === -1){
			roundOverlay.isInCluster = false;  //用来判断这个覆盖物是否在聚合中
			this._roundOverlays.push(roundOverlay);
		}
	};

	/**
	 * 添加一个聚合的覆盖物。
	 * @param {BMap.RoundOverlay} roundOverlay 要聚合的单个覆盖物。
	 * @return 无返回值。
	 */
	RoundOverlayClusterer.prototype.addRoundOverlay = function(roundOverlay) {
		this._pushRoundOverlayTo(roundOverlay);
		this._createClusters();
	};

	/**
	 * 根据所给定的覆盖物，创建聚合点
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype._createClusters = function(){
		var mapBounds = this._map.getBounds();
		var extendedBounds = getExtendedBounds(this._map, mapBounds, this._gridSize);
		for(var i = 0, roundOverlay; roundOverlay = this._roundOverlays[i]; i++){
			if(!roundOverlay.isInCluster && extendedBounds.containsPoint(roundOverlay.getPosition()) ){ 
				this._addToClosestCluster(roundOverlay);
			}
		}   
	};

	/**
	 * 根据覆盖物的位置，把它添加到最近的聚合中
	 * @param {BMap.RoundOverlay} roundOverlay 要进行聚合的单个覆盖物
	 *
	 * @return 无返回值。
	 */
	RoundOverlayClusterer.prototype._addToClosestCluster = function (roundOverlay){
		var distance = 4000000;
		var clusterToAddTo = null;
		//var position = roundOverlay.getPosition();
		for(var i = 0, cluster; cluster = this._clusters[i]; i++){
			var center = cluster.getCenter();
			if(center){
				var d = this._map.getDistance(center, roundOverlay.getPosition());   //返回两点之间的距离，单位是米
				if(d < distance){
					distance = d;
					clusterToAddTo = cluster;
				}
			}
		}

		if (clusterToAddTo && clusterToAddTo.isRoundOverlayInClusterBounds(roundOverlay)){
			clusterToAddTo.addRoundOverlay(roundOverlay);
		} else {
			var cluster = new Cluster(this);
			cluster.addRoundOverlay(roundOverlay);            
			this._clusters.push(cluster);
		}    
	};

	/**
	 * 清除上一次的聚合的结果
	 * @return 无返回值。
	 */
	RoundOverlayClusterer.prototype._clearLastClusters = function(){
		for(var i = 0, cluster; cluster = this._clusters[i]; i++){            
			cluster.remove();
		}
		this._clusters = [];//置空Cluster数组
		this._removeRoundOverlaysFromCluster();//把RoundOverlay的cluster标记设为false
	};

	/**
	 * 清除某个聚合中的所有覆盖物
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype._removeRoundOverlaysFromCluster = function(){
		for(var i = 0, roundOverlay; roundOverlay = this._roundOverlays[i]; i++){
			roundOverlay.isInCluster = false;
		}
	};

	/**
	 * 把所有的覆盖物从地图上清除
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype._removeRoundOverlaysFromMap = function(){
		for(var i = 0, roundOverlay; roundOverlay = this._roundOverlays[i]; i++){
			roundOverlay.isInCluster = false;
			this._map.removeOverlay(roundOverlay);       
		}
	};

	/**
	 * 删除单个覆盖物（工具方法）
	 * @param {BMap.RoundOverlay} roundOverlay 需要被删除的roundOverlay
	 *
	 * @return {Boolean} 删除成功返回true，否则返回false
	 */
	RoundOverlayClusterer.prototype._removeRoundOverlay = function(roundOverlay) {
		var index = indexOf(roundOverlay, this._roundOverlays);
		if (index === -1) {
			return false;
		}
		this._map.removeOverlay(roundOverlay);
		this._roundOverlays.splice(index, 1);
		return true;
	};

	/**
	 * 删除单个覆盖物
	 * @param {BMap.RoundOverlay} roundOverlay 需要被删除的roundOverlay
	 *
	 * @return {Boolean} 删除成功返回true，否则返回false
	 */
	RoundOverlayClusterer.prototype.removeRoundOverlay = function(roundOverlay) {
		var success = this._removeRoundOverlay(roundOverlay);
		if (success) {
			this._clearLastClusters();
			this._createClusters();
		}
		return success;
	};

	/**
	 * 删除一组覆盖物
	 * @param {Array<BMap.RoundOverlay>} roundOverlays 需要被删除的roundOverlay数组
	 *
	 * @return {Boolean} 删除成功返回true，否则返回false
	 */
	RoundOverlayClusterer.prototype.removeRoundOverlays = function(roundOverlays) {
		var success = false;
		while(roundOverlays.length){
			var r = this._removeRoundOverlay(roundOverlays[0]);
			roundOverlays.splice(0,1);  //将roundOverlays[0]删除
			success = success || r; 
		}

		if (success) {
			this._clearLastClusters();
			this._createClusters();
		}
		return success;
	};

	/**
	 * 从地图上彻底清除所有的覆盖物
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype.clearRoundOverlays = function() {
		this._clearLastClusters();
		this._removeRoundOverlaysFromMap();
		this._roundOverlays = [];
	};

	/**
	 * 重新生成，比如改变了属性等
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype._redraw = function () {
		this._clearLastClusters();
		this._createClusters();
	};

	/**
	 * 获取网格大小
	 * @return {Number} 网格大小
	 */
	RoundOverlayClusterer.prototype.getGridSize = function() {
		return this._gridSize;
	};

	/**
	 * 设置网格大小
	 * @param {Number} size 网格大小
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype.setGridSize = function(size) {
		this._gridSize = size;
		this._redraw();
	};

	/**
	 * 获取聚合的最大缩放级别。
	 * @return {Number} 聚合的最大缩放级别。
	 */
	RoundOverlayClusterer.prototype.getMaxZoom = function() {
		return this._maxZoom;       
	};

	/**
	 * 设置聚合的最大缩放级别
	 * @param {Number} maxZoom 聚合的最大缩放级别
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype.setMaxZoom = function(maxZoom) {
		this._maxZoom = maxZoom;
		this._redraw();
	};

	/**
	 * 获取聚合的样式风格集合
	 * @return {Array<IconStyle>} 聚合的样式风格集合
	 */
	RoundOverlayClusterer.prototype.getStyles = function() {
		return this._styles;
	};

	/**
	 * 设置聚合的样式风格集合
	 * @param {Array<IconStyle>} styles 样式风格数组
	 * @return 无返回值
	 */
	RoundOverlayClusterer.prototype.setStyles = function(styles) {
		/**
		 * "styles":{Array} 一组图标风格。单个图表风格包括以下几个属性：
		 * 		url	{String} 图片的url地址。(必选)
		 * 		size {Size}	图片的大小。（必选）
		 * 		anchor {Size} 图标定位在地图上的位置相对于图标左上角的偏移值，默认偏移值为图标的中心位置。（可选）
		 * 		offset {Size} 图片相对于可视区域的偏移值，此功能的作用等同于CSS中的background-position属性。（可选）
		 * 		textSize {Number} 文字的大小。（可选，默认10）
		 * 		textColor {String} 文字的颜色。（可选，默认black）
		 */
		this._styles = styles;
		this._redraw();
	};

	/**
	 * 获取单个聚合的最小数量。
	 * @return {Number} 单个聚合的最小数量。
	 */
	RoundOverlayClusterer.prototype.getMinClusterSize = function() {
		return this._minClusterSize;
	};

	/**
	 * 设置单个聚合的最小数量。
	 * @param {Number} size 单个聚合的最小数量。
	 * @return 无返回值。
	 */
	RoundOverlayClusterer.prototype.setMinClusterSize = function(size) {
		this._minClusterSize = size;
		this._redraw();
	};

	/**
	 * 获取单个聚合的落脚点是否是聚合内所有自定义覆盖物的平均中心。
	 * @return {Boolean} true或false。
	 */
	RoundOverlayClusterer.prototype.isAverageCenter = function() {
		return this._isAverageCenter;
	};

	/**
	 * 获取聚合的Map实例。
	 * @return {Map} Map的示例。
	 */
	RoundOverlayClusterer.prototype.getMap = function() {
		return this._map;
	};

	/**
	 * 获取所有的覆盖物数组。
	 * @return {Array<RoundOverlay>} 覆盖物数组。
	 */
	RoundOverlayClusterer.prototype.getRoundOverlays = function() {
		return this._roundOverlays;
	};

	/**
	 * 获取聚合的总数量。
	 * @return {Number} 聚合的总数量。
	 */
	RoundOverlayClusterer.prototype.getClustersCount = function() {
		var count = 0;
		for(var i = 0, cluster; cluster = this._clusters[i]; i++){
			cluster.isReal() && count++;     
		}
		return count;
	};

	/**
	 * @ignore
	 * Cluster
	 * @class 表示一个聚合对象，该聚合，包含有N个自定义覆盖物，这N个自定义覆盖物组成的范围，并有予以显示在Map上的TextIconOverlay等。
	 * @constructor
	 * @param {RoundOverlayClusterer} roundOverlayClusterer 一个覆盖物聚合器示例。
	 */
	function Cluster(roundOverlayClusterer){
		this._roundOverlayClusterer = roundOverlayClusterer;
		this._map = roundOverlayClusterer.getMap();
		this._minClusterSize = roundOverlayClusterer.getMinClusterSize();
		this._isAverageCenter = roundOverlayClusterer.isAverageCenter();
		this._center = null; //落脚位置
		this._roundOverlays = []; //这个Cluster中所包含的roundOverlays
		this._gridBounds = null; //以中心点为准，向四边扩大gridSize个像素的范围，也即网格范围
		this._isReal = false; //真的是个聚合

		this._clusterMarker = new BMapLib.TextIconOverlay(this._center, this._roundOverlays.length, {"styles":this._roundOverlayClusterer.getStyles()});

		this._infoBox = null;
		this._html = "<div class='swiper-container'><ul class='swiper-wrapper'>"; //形成html代码，用于点击聚合点时出现这个聚合点汇集的列表
		//this._map.addOverlay(this._clusterMarker);
	}

	var tempInfoBox = null; //用来存放打开的infoBox，然后通过它关闭已经打开的infoBox，也就是使得地图上每次只有一个infoBox打开
	
	/**
	 * 向该聚合添加一个覆盖物。
	 * @param {RoundOverlay} roundOverlay 要添加的覆盖物。
	 * @return 无返回值。
	 */
	Cluster.prototype.addRoundOverlay = function(roundOverlay){
		if(this.isRoundOverlayInCluster(roundOverlay)){
			return false;
		}

		if (!this._center){
			this._center = roundOverlay.getPosition();
			this.updateGridBounds(); //默认情况下，用第一个点产生一个聚合时，这个网格大小是120px*120px
		} else {
			if(this._isAverageCenter){
				var l = this._roundOverlays.length + 1;
				var lat = (this._center.lat * (l - 1) + roundOverlay.getPosition().lat) / l;
				var lng = (this._center.lng * (l - 1) + roundOverlay.getPosition().lng) / l;
				this._center = new BMap.Point(lng, lat);
				this.updateGridBounds();
			} //计算新的Center
		}

		roundOverlay.isInCluster = true;
		this._roundOverlays.push(roundOverlay);

		var len = this._roundOverlays.length;
		if(len < this._minClusterSize ){     
			this._map.addOverlay(roundOverlay);
			roundOverlay.addEventListener("touchend", function(){
				if(roundOverlay.getCurUserId() === roundOverlay.getParUserId()){ //进入我发布的局
					window.location.href = jQuery("#webPath").val() + "/WebContent/organized_party.htm?partyId=" + roundOverlay.getId();
				}else{
					if(roundOverlay.getJoinStatus() === 1){ //进入我参加的局
						window.location.href = jQuery("#webPath").val() + "/WebContent/joined_party.htm?partyId=" + roundOverlay.getId();
					}else{ //进入其他局
						window.location.href = jQuery("#webPath").val() + "/WebContent/others_party.htm?partyId=" + roundOverlay.getId();
					}
				}
			});
			//添加聚合点中关联的第一条信息
			this._html = this._html + "<li class='swiper-slide' id='li_" + roundOverlay.getId() + "' data-curUserId='" + roundOverlay.getCurUserId() + "' data-parUserId='" + roundOverlay.getParUserId() + "' data-joinStatus='" + roundOverlay.getJoinStatus() + "'>";
			if(roundOverlay.getCurUserId() === roundOverlay.getParUserId()){
				this._html = this._html + "<a href='" + jQuery("#webPath").val() + "/WebContent/organized_party.htm?partyId=" + roundOverlay.getId() + "'>";
			}else{
				if(roundOverlay.getJoinStatus() === 1){
					this._html = this._html + "<a href='" + jQuery("#webPath").val() + "/WebContent/joined_party.htm?partyId=" + roundOverlay.getId() + "'>";
				}else{
					this._html = this._html + "<a href='" + jQuery("#webPath").val() + "/WebContent/others_party.htm?partyId=" + roundOverlay.getId() + "'>";
				}
			}
			this._html = this._html + "<img src='../resources/imgs/party_pos.png' class='party-position'>" +
			"<span class='party-title'>" + this._roundOverlays[0].getTitle() + 
			"</span><img src='../resources/imgs/party_detail.png' class='party-detail'>" +
			"</a></li>";
			//this.updateClusterMarker();
			return true;
		} else if (len === this._minClusterSize) {
			for (var i = 0; i < len; i++) {
				this._roundOverlays[i].getMap() && this._map.removeOverlay(this._roundOverlays[i]);
			}
		} 
		this._map.addOverlay(this._clusterMarker);
		this._isReal = true;
		this.updateClusterMarker();
		return true;
	};

	/**
	 * 判断一个覆盖物是否在该聚合中。
	 * @param {RoundOverlay} roundOverlay 要判断的覆盖物。
	 * @return {Boolean} true或false。
	 */
	Cluster.prototype.isRoundOverlayInCluster= function(roundOverlay){
		if (this._roundOverlays.indexOf) {
			return this._roundOverlays.indexOf(roundOverlay) != -1;
		} else {
			for (var i = 0, m; m = this._roundOverlays[i]; i++) {
				if (m === roundOverlay) {
					return true;
				}
			}
		}
		return false;
	};

	/**
	 * 判断一个覆盖物是否在该聚合网格范围中。
	 * @param {RoundOverlay} roundOverlay 要判断的覆盖物。
	 * @return {Boolean} true或false。
	 */
	Cluster.prototype.isRoundOverlayInClusterBounds = function(roundOverlay) {
		return this._gridBounds.containsPoint(roundOverlay.getPosition());
	};

	Cluster.prototype.isReal = function(marker) {
		return this._isReal;
	};

	/**
	 * 更新该聚合的网格范围。
	 * @return 无返回值。
	 */
	Cluster.prototype.updateGridBounds = function() {
		var bounds = new BMap.Bounds(this._center, this._center);
		this._gridBounds = getExtendedBounds(this._map, bounds, this._roundOverlayClusterer.getGridSize());
	};

	/**
	 * 更新该聚合的显示样式，也即TextIconOverlay。
	 * @return 无返回值。
	 */
	Cluster.prototype.updateClusterMarker = function () {
		//当地图级别比聚合设置的最大级别大时，就不聚合，显示原本的自定义覆盖物
		if (this._map.getZoom() > this._roundOverlayClusterer.getMaxZoom()) {
			this._clusterMarker && this._map.removeOverlay(this._clusterMarker);
			for (var i = 0, roundOverlay; roundOverlay = this._roundOverlays[i]; i++) {
				this._map.addOverlay(roundOverlay);
				roundOverlay.addEventListener("touchend", function(){
					if(roundOverlay.getCurUserId() === roundOverlay.getParUserId()){ //进入我发布的局
						window.location.href = jQuery("#webPath").val() + "/WebContent/organized_party.htm?partyId=" + roundOverlay.getId();
					}else{
						if(roundOverlay.getJoinStatus() === 1){ //进入我参加的局
							window.location.href = jQuery("#webPath").val() + "/WebContent/joined_party.htm?partyId=" + roundOverlay.getId();
						}else{ //进入其他局
							window.location.href = jQuery("#webPath").val() + "/WebContent/others_party.htm?partyId=" + roundOverlay.getId();
						}
					}
    			});
			}
			return;
		}

		if (this._roundOverlays.length < this._minClusterSize) {
			this._clusterMarker.hide();
			return;
		}

		this._clusterMarker.setPosition(this._center);
		this._clusterMarker.setText(this._roundOverlays.length + "场");

		//添加聚合点中关联信息第一条之后的信息，因为聚合是一个一个聚合的，所以信息是一条一条添加，不是循环添加
		this._html = this._html + "<li class='swiper-slide' style='border-top:1px solid #e6e6e6;' id='li_" + this._roundOverlays[this._roundOverlays.length-1].getId() + "' data-curUserId='" + this._roundOverlays[this._roundOverlays.length-1].getCurUserId() + "' data-parUserId='" + this._roundOverlays[this._roundOverlays.length-1].getParUserId() + "' data-joinStatus='" + this._roundOverlays[this._roundOverlays.length-1].getJoinStatus() + "'>";
		if(this._roundOverlays[this._roundOverlays.length-1].getCurUserId() === this._roundOverlays[this._roundOverlays.length-1].getParUserId()){
			this._html = this._html + "<a href='" + jQuery("#webPath").val() + "/WebContent/organized_party.htm?partyId=" + this._roundOverlays[this._roundOverlays.length-1].getId() + "'>";
		}else{
			if(this._roundOverlays[this._roundOverlays.length-1].getJoinStatus() === 1){
				this._html = this._html + "<a href='" + jQuery("#webPath").val() + "/WebContent/joined_party.htm?partyId=" + this._roundOverlays[this._roundOverlays.length-1].getId() + "'>";
			}else{
				this._html = this._html + "<a href='" + jQuery("#webPath").val() + "/WebContent/others_party.htm?partyId=" + this._roundOverlays[this._roundOverlays.length-1].getId() + "'>";
			}
		}
		this._html = this._html + "<img src='../resources/imgs/party_pos.png' class='party-position'>" +
		"<span class='party-title'>"+ this._roundOverlays[this._roundOverlays.length-1].getTitle() + 
		"</span><img src='../resources/imgs/party_detail.png' class='party-detail'>" +
		"</a></li>";

		var thatInfoBox = this._infoBox;
		var thatHtml = this._html;
		var thatMap = this._map;
		var thatBounds = this.getBounds();
		var thatCenter = this._center;
		this._clusterMarker.addEventListener("click", function(event){
			if (thatMap.getZoom() === 19) {
				if(tempInfoBox){
					tempInfoBox.close();
				}
				//alert(event.point);
				thatHtml = thatHtml + "</ul></div><div class='list-scroll'><img src='../resources/imgs/scroll.png' height='17' width='17' data-dirMark='down'></div>";
				thatInfoBox = new BMapLib.InfoBox(thatMap,thatHtml,{align: INFOBOX_AT_TOP});
				tempInfoBox = thatInfoBox;
				thatInfoBox.open(new BMap.Point(thatCenter.lng,thatCenter.lat)); //要在哪个marker或者point上打开infobox
				thatInfoBox.addEventListener("open", function(e) {
					var liArray = jQuery(".infoBox li"); //取出打开的infoBox里所有li
					var len = liArray.length;
					if(len >= 2 && len < 5){
						jQuery(".infoBox").css("height",len*35+(len-1)+20+"px");
						jQuery(".swiper-container").css("height",len*35+(len-1)+"px");
					}else if(len >= 5){
						if(len == 5){
							jQuery(".infoBox").css("height","199px");
						}else{
							jQuery(".infoBox").css("height","219px");
						}
						jQuery(".swiper-container").css("height","179px");
					}
					//只有数量大于5时，才需要列表滑动
					if(len > 5){
						jQuery(".list-scroll").css("display","block");
						var swiper = new Swiper('.swiper-container', {
							onReachBeginning: function(mySwiper){
								if(jQuery(".list-scroll img").attr("data-dirMark") === "up"){
									jQuery(".list-scroll img").css({"transform":"rotate(0deg)","-webkit-transform":"rotate(0deg)","-ms-transform":"rotate(0deg)"});
									jQuery(".list-scroll img").attr("data-dirMark","down");
								}
							},
							onReachEnd: function(mySwiper){
								jQuery(".list-scroll img").attr("data-dirMark","up");
					        	jQuery(".list-scroll img").css({"transform":"rotate(180deg)","-webkit-transform":"rotate(180deg)","-ms-transform":"rotate(180deg)"});
					        },
					    	direction : 'vertical',
					        slidesPerView: 5,
					        freeMode: true, //默认为false，普通模式：slide滑动时只滑动一格，并自动贴合wrapper，设置为true则变为free模式，slide会根据惯性滑动且不会贴合。
					        freeModeMomentum : false, //free模式动量。free模式下，若设置为false则关闭动量，释放slide之后立即停止不会滑动。
					        resistanceRatio : 0 //抵抗率。边缘抵抗力的大小比例。值越小抵抗越大越难将slide拖离边缘，0时完全无法拖离。
					    });
					}
				});
			} else {
				thatMap.setViewport(thatBounds);  //根据提供的地理区域或坐标设置地图视野，调整后的视野会保证包含提供的地理区域或坐标。
			}
		});
		this._clusterMarker.addEventListener("touchend", function(event){
			if (thatMap.getZoom() === 19) {
				if(tempInfoBox){
					tempInfoBox.close();
				}
				//alert(thatCenter.lng);
				thatHtml = thatHtml + "</ul></div><div class='list-scroll'><img src='../resources/imgs/scroll.png' height='17' width='17' data-dirMark='down'></div>";
				thatInfoBox = new BMapLib.InfoBox(thatMap,thatHtml,{align: INFOBOX_AT_TOP});
				tempInfoBox = thatInfoBox;
				thatInfoBox.open(new BMap.Point(thatCenter.lng,thatCenter.lat));//要在哪个marker或者point上打开infobox
				thatInfoBox.addEventListener("open", function(e) {
					var liArray = jQuery(".infoBox li");  //取出打开的infoBox里所有li
					var len = liArray.length;
					if(len >= 2 && len < 5){
						jQuery(".infoBox").css("height",len*35+(len-1)+20+"px");
						jQuery(".swiper-container").css("height",len*35+(len-1)+"px");
					}else if(len >= 5){
						if(len == 5){
							jQuery(".infoBox").css("height","199px");
						}else{
							jQuery(".infoBox").css("height","219px");
						}
						jQuery(".swiper-container").css("height","179px");
					}
					//只有数量大于5时，才需要列表滑动
					if(len > 5){
						jQuery(".list-scroll").css("display","block");
						var swiper = new Swiper('.swiper-container', {
							onReachBeginning: function(mySwiper){
								if(jQuery(".list-scroll img").attr("data-dirMark") === "up"){
									jQuery(".list-scroll img").css({"transform":"rotate(0deg)","-webkit-transform":"rotate(0deg)","-ms-transform":"rotate(0deg)"});
									jQuery(".list-scroll img").attr("data-dirMark","down");
								}
							},
							onReachEnd: function(mySwiper){
								jQuery(".list-scroll img").attr("data-dirMark","up");
					        	jQuery(".list-scroll img").css({"transform":"rotate(180deg)","-webkit-transform":"rotate(180deg)","-ms-transform":"rotate(180deg)"});
					        },
					    	direction : 'vertical',
					        slidesPerView: 5,
					        freeMode: true,
					        freeModeMomentum : false,
					        resistanceRatio : 0,
					        onTap: function(mySwiper){ //回调函数，当你轻触(tap)Swiper后执行。在移动端，click会有 200~300 ms延迟，所以用tap代替click作为点击事件。
					        	for(var i = 0;i < len;i++){
									//给当前打开的infoBox里面的li添加点击列表项进入详情的事件监听
									//只有当前打开的infoBox可以获取到li的id
									var li_id = liArray[i].getAttribute("id");
									if(li_id!=null && li_id!=""){
										document.getElementById(li_id).addEventListener("touchend", function(){
											if(jQuery(this).attr("data-curUserId") === jQuery(this).attr("data-parUserId")){
												window.location.href = jQuery("#webPath").val() + "/WebContent/organized_party.htm?partyId=" + jQuery(this).attr("id").split("li_")[1]; 
											}else{
												if(jQuery(this).attr("data-joinStatus") === 1){
													window.location.href = jQuery("#webPath").val() + "/WebContent/joined_party.htm?partyId=" + jQuery(this).attr("id").split("li_")[1]; 
												}else{
													window.location.href = jQuery("#webPath").val() + "/WebContent/others_party.htm?partyId=" + jQuery(this).attr("id").split("li_")[1]; 
												}
											}
										});
									}
								}
					        }
					    });
					} else {
						if(len > 0){
							for(var i = 0;i < len;i++){
								//给当前打开的infoBox里面的li添加点击列表项进入详情的事件监听
								//只有当前打开的infoBox可以获取到li的id
								var li_id = liArray[i].getAttribute("id");
								if(li_id!=null && li_id!=""){
									document.getElementById(li_id).addEventListener("touchend", function(){
										if(jQuery(this).attr("data-curUserId") === jQuery(this).attr("data-parUserId")){
											window.location.href = jQuery("#webPath").val() + "/WebContent/organized_party.htm?partyId=" + jQuery(this).attr("id").split("li_")[1]; 
										}else{
											if(jQuery(this).attr("data-joinStatus") === 1){
												window.location.href = jQuery("#webPath").val() + "/WebContent/joined_party.htm?partyId=" + jQuery(this).attr("id").split("li_")[1]; 
											}else{
												window.location.href = jQuery("#webPath").val() + "/WebContent/others_party.htm?partyId=" + jQuery(this).attr("id").split("li_")[1];
											}
										}
									});
								}
							}
						}
					}
				});
			} else {
				thatMap.setViewport(thatBounds); //根据提供的地理区域或坐标设置地图视野，调整后的视野会保证包含提供的地理区域或坐标。
			}
		});

	};

	/**
	 * 删除该聚合。
	 * @return 无返回值。
	 */
	Cluster.prototype.remove = function(){
		for (var i = 0, m; m = this._roundOverlays[i]; i++) {
			this._roundOverlays[i].getMap() && this._map.removeOverlay(m);
		}//清除散的自定义覆盖物点
		this._map.removeOverlay(this._clusterMarker);
		this._roundOverlays.length = 0;
		delete this._roundOverlays;
	};

	/**
	 * 获取该聚合所包含的所有自定义覆盖物的最小外接矩形的范围。
	 * 只是把点包括进去.
	 * @return {BMap.Bounds} 计算出的范围。
	 */
	Cluster.prototype.getBounds = function() {
		var bounds = new BMap.Bounds(this._center,this._center); //矩形初始化
		for (var i = 0, roundOverlay; roundOverlay = this._roundOverlays[i]; i++) {
			bounds.extend(roundOverlay.getPosition()); //放大此矩形，使其包含给定的点。
		}
		return bounds;
	};

	/**
	 * 获取该聚合的落脚点。
	 * @return {BMap.Point} 该聚合的落脚点。
	 */
	Cluster.prototype.getCenter = function() {
		return this._center;
	};

})();

