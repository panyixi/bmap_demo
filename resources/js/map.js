var map = null,
    roundOverlayClusterer = null,
    tempCircle = null,
    tempMark = null,
    lastRoundOverlays = []; //存放更改筛选条件之前的自定义覆盖物数组

jQuery(document).ready(function(){
	map = new BMap.Map("container"); //创建地图实例  

	var point = new BMap.Point(121.497635,31.292725); //创建点坐标  
	map.centerAndZoom(point, 16); //初始化地图，设置中心点坐标和地图级别。19代表地图级别，级别越大，地图越详细。最小比例是20米
	map.setMinZoom(2);
	map.enableScrollWheelZoom(true); //允许鼠标滚动缩放地图

	//用户定位,返回用户当前的位置。此方法利用浏览器的geolocation接口获取用户当前位置，不支持的浏览器将无法获取。
	var geolocation = new BMap.Geolocation();
	geolocation.getCurrentPosition(function(r){
		if(this.getStatus() == BMAP_STATUS_SUCCESS){
			var pt = r.point;
			var myIcon = new BMap.Icon(jQuery("#webPath").val()+"/resources/imgs/my_position.png", new BMap.Size(23,30), {imageSize:new BMap.Size(23,30)});
			var mk = new BMap.Marker(pt,{icon:myIcon});	
			map.addOverlay(mk);
			map.panTo(pt); //将地图的中心点更改为给定的点。
			mk.setAnimation(BMAP_ANIMATION_BOUNCE); //跳动的动画（只有PC端有效果）
			jQuery("span[class='BMap_Marker']").parent().css("z-index","19000000");
			mk.setTop(true); //将在一个div里面的所有marker中的某一个marker永远置于最顶层
			tempMark = mk;
			//mk.disableMassClear();	//禁止覆盖物在map.clearOverlays方法中被清除。
			//alert('您的位置：'+r.point.lng+','+r.point.lat);
		}else{
			alert("获取您当前所在位置失败");
		}        
	},{enableHighAccuracy: true}); //要求浏览器获取最佳效果
	
	//添加带有定位的导航控件
	var navigationControl = new BMap.NavigationControl({
		anchor: BMAP_ANCHOR_TOP_LEFT, //靠左上角位置
		offset: new BMap.Size(10, 60), //以像素为单位
		type: BMAP_NAVIGATION_CONTROL_LARGE, //LARGE类型
		enableGeolocation: true //启用显示定位  是
	});
	map.addControl(navigationControl);
	
	//添加定位控件
	var geolocationControl = new BMap.GeolocationControl({anchor: BMAP_ANCHOR_BOTTOM_RIGHT,offset: new BMap.Size(10, 10),showAddressBar: false,locationIcon: new BMap.Icon(jQuery("#webPath").val()+"/resources/imgs/hand_position.gif", new BMap.Size(30,30))});
	geolocationControl.addEventListener("locationSuccess", function(e){
		if(tempMark){
			map.removeOverlay(tempMark);
		}
		if(tempCircle){
			map.removeOverlay(tempCircle);
		}
		
		//定位成功事件
		var pt = e.point;
		//alert('您的位置：'+e.point.lng+','+e.point.lat);
		var circle = new BMap.Circle(pt,50,{fillColor:"#3e8dfb", strokeColor:"#3e8dfb", strokeWeight: 1 ,fillOpacity: 0.3, strokeOpacity: 0.3});   
		map.addOverlay(circle);
		tempCircle = circle;
	});
	geolocationControl.addEventListener("locationError",function(e){
		//定位失败事件
		alert("定位失败！");
	});
	map.addControl(geolocationControl);
	
	var scaleControl = new BMap.ScaleControl({anchor: BMAP_ANCHOR_TOP_LEFT,offset: new BMap.Size(55, 60)}); //左上角，添加比例尺
	map.addControl(scaleControl); //显示地图的比例关系 

	jQuery("#distance").html(jQuery("input[type='range']").val() + "km");
	nearbySearch();
});
/*-------------------------------------------------------------------------------------------------------------*/
//定义自定义圆形覆盖物的构造函数
function RoundOverlay(point, party) {
	this._point = point;
	this._imgUrl = "../" + party.userPhoto;
	this._partyStatus = party.status;
	this._id = party.id;
	this._title = party.title;
	this._parUserId = party.parUserId;
	this._curUserId = party.curUserId;
	this._joinStatus = party.joinStatus;
}

//继承API的BMap.Overlay
RoundOverlay.prototype = new BMap.Overlay();

//初始化
RoundOverlay.prototype.initialize = function(map){    
	//保存map对象实例   
	this._map = map;        
	//创建div元素，作为自定义覆盖物的容器   
	var div = document.createElement("div");
	div.setAttribute("id", this._id);
	div.style.position = "absolute";
	div.style.zIndex = BMap.Overlay.getZIndex(this._point.lat);
	//可以根据参数设置元素外观   
	div.style.width = "60px";    
	div.style.height = "60px";
	div.style.border = "1px solid #fff";
	div.style.borderRadius = "31px";
	div.style.overflow = "hidden";
	if(this._partyStatus === 1) {
		div.setAttribute("class","shine-red");
	}

	var a = document.createElement("a");
	div.appendChild(a);
	if(this._parUserId === this._curUserId){ //进入我发起的局
		a.setAttribute("href",jQuery("#webPath").val()+"/WebContent/organized_party.htm?partyId="+this._id);
	}else{	
		if(this._joinStatus === 1){	//进入我参加的局
			a.setAttribute("href",jQuery("#webPath").val()+"/WebContent/joined_party.htm?partyId="+this._id);
		}else{ //进入其他局
			a.setAttribute("href",jQuery("#webPath").val()+"/WebContent/others_party.htm?partyId="+this._id);
		}
	}
	
	var img = document.createElement("img");
	a.appendChild(img);
	img.setAttribute("height","60px");
	img.setAttribute("width","60px");
	img.setAttribute("src",this._imgUrl);

	//将div添加到覆盖物容器中   
	map.getPanes().markerPane.appendChild(div);      
	//保存div实例   
	this._div = div;
	this._a = a;
	this._img = img;
	//需要将div元素作为方法的返回值，当调用该覆盖物的show、   
	//hide方法，或者对覆盖物进行移除时，API都将操作此元素。   
	return div;
};

//实现绘制方法   
RoundOverlay.prototype.draw = function(){    
	//根据地理坐标转换为像素坐标，并设置给容器    
	var position = this._map.pointToOverlayPixel(this._point);    
	this._div.style.left = position.x - 30 + "px";    
	this._div.style.top = position.y - 30 + "px";    
};

//添加addEventListener事件
RoundOverlay.prototype.addEventListener = function(event,fun){  
	this._div["on"+event] = fun;  
};

//获取自定义覆盖物地理坐标
RoundOverlay.prototype.getPosition = function(){
	return this._point;
};

//获取自定义覆盖物图片url
RoundOverlay.prototype.getImgUrl = function(){
	return this._imgUrl;
};

//获取自定义覆盖物party的状态
RoundOverlay.prototype.getPartyStatus = function(){
	return this._partyStatus;
};

//获取自定义覆盖物party的id
RoundOverlay.prototype.getId = function(){
	return this._id;
};

//获取自定义覆盖物party的主题
RoundOverlay.prototype.getTitle = function(){
	return this._title;
};

//获取自定义覆盖物开局者id
RoundOverlay.prototype.getParUserId = function(){
	return this._parUserId;
};

//获取当前登录用户id
RoundOverlay.prototype.getCurUserId = function(){
	return this._curUserId;
};

//获取当前登录用户参加局的状态
RoundOverlay.prototype.getJoinStatus = function(){
	return this._joinStatus;
};

//获取覆盖物所在的map对象
RoundOverlay.prototype.getMap = function(){
	return map;
};
/*-------------------------------------------------------------------------------------------------------------*/
//查找附近的人，获取用户头像并显示在地图上
function nearbySearch(){
	var sex = jQuery("#sex").val();
	var distance = jQuery("input[type='range']").val();
	if(sex == null || sex == ""){
		sex = "unlimited";
	}
	if(distance == null || distance == ""){
		distance = "50";
	}
	/**
	 * ajax与后台交互，完成根据性别和距离的筛选功能，此处省略相关代码
	 * 只用一组静态数据partyList显示所有酒局
	 * 
	 */
	var partyList = [
	    {id:1, title:"酒局1", parUserId:187, status:0, joinStatus:1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162},
	    {id:2, title:"酒局2", parUserId:187, status:1, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:3, title:"酒局3", parUserId:187, status:2, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:4, title:"酒局4", parUserId:187, status:3, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:5, title:"酒局5", parUserId:187, status:1, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:6, title:"酒局6", parUserId:186, status:0, joinStatus:-1, userPhoto:"resources/imgs/touxiang.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:7, title:"酒局7", parUserId:185, status:0, joinStatus:1, userPhoto:"resources/imgs/tx1.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:8, title:"酒局8", parUserId:187, status:0, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:9, title:"酒局9", parUserId:187, status:1, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162}, 
	    {id:10, title:"酒局10", parUserId:187, status:1, joinStatus:-1, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.259162}, 
	    {id:11, title:"酒局11", parUserId:187, status:2, joinStatus:2, userPhoto:"resources/imgs/huhu.png", lng:121.487899, curUserId:187, lat:31.249162},
	    {id:12, title:"酒局12", parUserId:185, status:1, joinStatus:-1, userPhoto:"resources/imgs/tx1.png", lng:121.497899, curUserId:187, lat:31.249162},
	    {id:13, title:"酒局13", parUserId:185, status:0, joinStatus:1, userPhoto:"resources/imgs/tx1.png", lng:121.487899, curUserId:187, lat:31.239162},
	    {id:14, title:"酒局14", parUserId:186, status:1, joinStatus:-1, userPhoto:"resources/imgs/touxiang.png", lng:121.496899, curUserId:187, lat:31.249162},
	    {id:15, title:"酒局15", parUserId:186, status:0, joinStatus:-1, userPhoto:"resources/imgs/touxiang.png", lng:121.497999, curUserId:187, lat:31.249162},
	    {id:16, title:"酒局16", parUserId:186, status:0, joinStatus:1, userPhoto:"resources/imgs/touxiang.png", lng:121.497999, curUserId:187, lat:31.249162}
    ];
	
    if(lastRoundOverlays.length > 0){
    	roundOverlayClusterer.removeRoundOverlays(lastRoundOverlays);
    }
    var points_array = partyList;
    var len = points_array.length;
    var roundOverlays = [];
    //自定义聚合标记样式
    var styles = [{url:jQuery("#webPath").val()+"/resources/imgs/number.png", size:new BMap.Size(41,33), textColor:"#fff", textSize:14}];
    for(var i = 0;i < len;i++){
    	//已完成和已取消状态的酒局在地图上不显示
    	if(points_array[i].status === 2 || points_array[i].status === 3){
    		continue;
    	}
    	var pt = new BMap.Point(points_array[i].lng,points_array[i].lat);
    	var myRound = new RoundOverlay(pt,points_array[i]);
    	roundOverlays.push(myRound);
    	lastRoundOverlays.push(myRound);
    }
    //调用roundOverlayClusterer类即可。maxZoom默认是18，这里设为19是因为酒局会建在同一位置
    roundOverlayClusterer = new BMapLib.RoundOverlayClusterer(map, {gridSize:30, maxZoom:19, isAverageCenter:true, styles:styles, roundOverlays:roundOverlays});
	
}
/*-------------------------------------------------------------------------------------------------------------*/
//地域或街道关键字搜索
function pointSearch(){
	jQuery(".BMap_Marker").remove(); //只移除Marker覆盖物
	
	if (jQuery("#address").val()){
		var local = new BMap.LocalSearch(map, {
			renderOptions:{map: map}
		});
		local.search(jQuery("#address").val());
	}
};
/*-------------------------------------------------------------------------------------------------------------*/
function G(id) {
	return document.getElementById(id);
}

//关键字提示输入
var ac = new BMap.Autocomplete( //建立一个自动完成的对象
		{"input" : "address", //文本输入框元素及其id
		 "location" : map}
		);

ac.addEventListener("onhighlight", function(e) { //鼠标放在下拉列表上的事件
	var str = "";
	var _value = e.fromitem.value; //上一条记录的信息的结果数据。当直接选择所需要的地址时e.fromitem.index==-1,当从上至下一个一个点击选择,e.fromitem.index会>-1
	var value = "";
	if (e.fromitem.index > -1) {
		value = _value.province +  _value.city +  _value.district +  _value.street + _value.streetNumber + _value.business;
	}    
	str = "FromItem<br />index = " + e.fromitem.index + "<br />value = " + value;

	value = "";
	if (e.toitem.index > -1) {
		_value = e.toitem.value; //当前记录的信息的结果数据
		value = _value.province +  _value.city +  _value.district +  _value.street + _value.streetNumber + _value.business;
	}    
	str += "<br />ToItem<br />index = " + e.toitem.index + "<br />value = " + value;
	G("searchResultPanel").innerHTML = str;
});

var myValue;
ac.addEventListener("onconfirm", function(e) { //选中某条记录后触发
	var _value = e.item.value;
	myValue = _value.province +  _value.city +  _value.district +  _value.street + _value.streetNumber + _value.business;
	G("searchResultPanel").innerHTML ="onconfirm<br />index = " + e.item.index + "<br />myValue = " + myValue;

	setPlace();
});

function setPlace(){
	//map.clearOverlays();
	function myFun(){
		//var pp = local.getResults().getPoi(0).point;    //获取第一个智能搜索的结果
	}
	var local = new BMap.LocalSearch(map, { //智能搜索
		onSearchComplete: myFun
	});
	local.search(myValue);
}
/*-------------------------------------------------------------------------------------------------------------*/
/*显示或隐藏左侧菜单*/
function showMenu(){
	alert("主菜单");
}

/*切换视图*/
function switchView(){
	alert("切换视图");
}

/* 显示或隐藏顶部筛选面版 */
function showTopFilter(){
	var isShow = jQuery("#topfilter").attr("data-mark");
	var m = "<div class='black-overlay'></div>";
	if(isShow === "show"){
		jQuery("#topfilter").animate({top:"-169px"},100).attr("data-mark","hide");
		jQuery(".black-overlay").remove();
	}else{
		jQuery("body").append(m);
		jQuery("#topfilter").animate({top:"49px"},100).attr("data-mark","show");
		
		jQuery(".black-overlay").click(function(){
			jQuery("#topfilter").animate({top:"-169px"},100).attr("data-mark","hide");
			jQuery(".black-overlay").remove();
		});
	}
}

/*显示用户调节距离*/
function showDistance(){
	var dis = jQuery("input[type='range']").val();
	if(dis > 100){
		jQuery("#distance").html("100km+");
	}else{
		jQuery("#distance").html(dis + "km");
	}
	nearbySearch();
	var isShow = jQuery("#topfilter").attr("data-mark");
	if(isShow === "show"){
		jQuery("#topfilter").animate({top:"-169px"},100).attr("data-mark","hide");
		jQuery(".black-overlay").remove();
	}
}

/* 获取性别条件 */
function setSex(sex){
	jQuery(".sex").removeClass("sex-focus");
	document.getElementById("setSex").addEventListener("click", function(e){
		if(e.target && e.target.nodeName == "INPUT"){
			jQuery(e.target).addClass("sex-focus");
		}
	}, false);
	jQuery("#sex").val(sex);
	nearbySearch();
	var isShow = jQuery("#topfilter").attr("data-mark");
	if(isShow === "show"){
		jQuery("#topfilter").animate({top:"-169px"},100).attr("data-mark","hide");
		jQuery(".black-overlay").remove();
	}
}