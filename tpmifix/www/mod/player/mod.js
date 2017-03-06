(function() {
	'use strict';

	/**
	 * @description
	 * One custom media player to play video, audio...
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.player
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 * @requires com.2fdevs.videogular
	 * @requires com.2fdevs.videogular.plugins.controls
	 * @requires com.2fdevs.videogular.plugins.overlayplay
	 * @requires com.2fdevs.videogular.plugins.buffering
	 * @requires com.2fdevs.videogular.plugins.poster
	 */
	angular.module('tpmifix.mod.player', [
		'tpmifix.service',
		'tpmifix.util',
		'tpmifix.protocol',
		"com.2fdevs.videogular",
		"com.2fdevs.videogular.plugins.controls",
		"com.2fdevs.videogular.plugins.overlayplay",
		"com.2fdevs.videogular.plugins.buffering",
		"com.2fdevs.videogular.plugins.poster"
	])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('player', {
					url: '/player',
					params: {
						// every array item is an object which has these fileds: `{name: "xxx", sources: [{src: "yyy", type: "zzz"}]}`.
						playlist: [],
						autoPlay: false
					},
					templateUrl: 'mod/player/mod.html',
					controller: 'playerCtrl as player'
				})
		}
	])

	.constant('playerConstant', {
		mediaTypeList: {
			video: ["mov", "mp4", "mpeg4", "ogg", "webm"],
			audio: ["flac", "mp3", "mod", "mid", "ogg", "wma"]
		}
	})

	.value('playerValue', {})

	.controller('playerCtrl', ['playerConstant', 'playerValue', 'tpService', 'tpUtil', 'tpProtocol',
		'$scope', '$sce', '$timeout', '$window',
		function(playerConstant, playerValue, tpService, tpUtil, tpProtocol,
			$scope, $sce, $timeout, $window) {
			var player = this;
			tpService.modService.initMod($scope, undefined, true);

			player.data = {
				// local data. If needed, define it to process local data or local flags
				local: {},
				// server data.
				server: {},
				// server data's backup. If needed, define it to backup server data, which is used to compare modification before submit data to server.
				backup: {}
			};

			// Init playlist
			// 1st, try to get playlist from router params
			player.data.local.list = tpService.linkService.getModParams().playlist;
			// 2nd, try to get playlist from dataSharingService
			if (!player.data.local.list || player.data.local.list.length === 0) {
				player.data.local.list = tpService.dataSharingService.get("player.playlist");
			}
			// playlist not found
			if (!player.data.local.list || player.data.local.list.length === 0) {
				tpService.logService.warn("playlist is blank.");
				// set one blank media file
				player.data.local.list = [{
					name: "No files.",
					sources: [{
						src: $sce.trustAsResourceUrl(""),
						type: "video/mp4"
					}, ]
				}];
			} else {
				for (var i in player.data.local.list) {
					for (var j in player.data.local.list[i].sources) {
						// map `mov` to `mp4`
						if (player.data.local.list[i].sources[j].type == "video/mov") {
							player.data.local.list[i].sources[j].type = "video/mp4";
						}
					}
				}
			}
			player.data.local.autoPlay = tpService.linkService.getModParams().autoPlay;
			if (angular.isUndefined(player.data.local.autoPlay)) {
				player.data.local.autoPlay = tpService.dataSharingService.get("player.autoPlay");
			}

			player.data.local.currentVideo = 0;
			player.data.local.config = {
				autoPlay: player.data.local.autoPlay ? true : false,
				sources: player.data.local.list[0].sources,
				/*
				sources: [
					{src: $sce.trustAsResourceUrl("http://static.videogular.com/assets/videos/videogular.mp4"), type: "video/mp4"},
					{src: $sce.trustAsResourceUrl("http://static.videogular.com/assets/videos/videogular.webm"), type: "video/webm"},
					{src: $sce.trustAsResourceUrl("http://static.videogular.com/assets/videos/videogular.ogg"), type: "video/ogg"},
				],
				tracks: [
					{
					src: "http://www.videogular.com/assets/subs/pale-blue-dot.vtt",
					kind: "subtitles",
					srclang: "en",
					label: "English",
					default: ""
				}
				],
				*/
				theme: "lib/videogular-themes-default/videogular.css",
				plugins: {
					controls: {
						autohide: true,
						autohideTime: 3000
					},
					poster: "assets/images/poster.png"
				}
			};

			player.action = {
				onPlayerReady: function(API) {
					tpService.logService.debug("player.onPlayerReady, API=" + API);
					player.API = API;
				},
				// Invoked when complete play.
				onCompleteVideo: function() {
					tpService.logService.debug("player.onCompleteVideo");
					player.data.local.isCompleted = true;
					player.data.local.currentVideo++;
					if (player.data.local.currentVideo >= player.data.local.list.length) {
						player.data.local.currentVideo = 0;
					}
					player.action.setVideo(player.data.local.currentVideo);
				},
				setVideo: function(index) {
					tpService.logService.debug("player.setVideo, index=" + index);
					player.API.stop();
					player.data.local.currentVideo = index;
					player.data.local.config.sources = player.data.local.list[index].sources;
					if (checkMediaValid(player.data.local.list[index].sources[0].type)) {
						$timeout(player.API.play.bind(player.API), 100);
					} else {
						tpService.promptService.toast.warning("PLAYER.CONTENT.NOT_SUPPORTED_MEDIA_TYPE.ANY");
					}
				}
			};

			function checkMediaValid(type) {
				if (playerConstant.mediaTypeList.video.indexOf(type.substring(6)) < 0 &&
					playerConstant.mediaTypeList.audio.indexOf(type.substring(6)) < 0) {
					return false;
				}
				return true;
			}
		}
	])

})();
