(function() {
	'use strict';

	/**
	 * @description
	 * SDCard is module to manage files in MiFi's SDCard, and share them to social network.
	 *
	 * @memberof tpmifix.mod
	 * @ngdoc overview
	 * @name tpmifix.mod.sdcard
	 * @requires tpmifix.service
	 * @requires tpmifix.util
	 * @requires tpmifix.protocol
	 */
	angular.module('tpmifix.mod.sdcard', ['tpmifix.service', 'tpmifix.util', 'tpmifix.protocol', 'tpmifix.mod.home', 'angular-thumbnails', 'pdf'])

	.config(['$stateProvider', '$urlRouterProvider',
		function($stateProvider, $urlRouterProvider) {
			$stateProvider
				.state('sdcard', {
					url: '/sdcard',
					templateUrl: 'mod/sdcard/mod.html',
					controller: 'sdcardCtrl as sdcard'
				})
		}
	])

	.constant('sdcardConstant', {
		ACCESS_MODE: {
			USB: 0,
			WIFI: 1
		},
		CONNECT_STATUS: {
			DISCONNECTED: 0,
			CONNECTING: 1,
			CONNECTED: 2
		},
		FILE_TYPE: {
			UNKNOWN: -1,
			FILE: 0,
			DIR: 1,
			LINK: 2
		},
		MEDIA_TYPE: {
			NONE: '',
			IMAGE: 'image',
			VIDEO: 'video',
			AUDIO: 'audio',
			TEXT: 'text',
			APPLICATION: 'application',
			OTHER: 'other'
		},
		FILE_AVATAR: {
			FOLDER: 'folder.png',
			IMAGE: 'image.png',
			VIDEO: 'video.png',
			AUDIO: 'audio.png',
			TEXT: 'text.png',
			APPLICATION: 'text.png',
			OTHER: 'other.png'
		},
		ALBUM_NAME: 'TPMiFi',
		FILE_CACHE_KEY: 'sdcard.cache.'
	})

	.value('sdcardValue', {
		FTP_HOME_PATH: '/sdcard',
		FTP_ACCOUNT: {
			USERNAME: 'anonymous',
			PASSWORD: 'anonymous@'
		},
		// Simulate ftp file list, for no ftp server.
		// If is PC browser, it will be changed to `true` automatically at runtime.
		SIMULATE: false
	})

	.controller('sdcardCtrl', ['sdcardConstant', 'sdcardValue', 'sdcardUtil', 'detectMediaTypeUtil', 'tpService', 'tpUtil', 'tpProtocol', 'homeUtil',
		'$scope', '$sce', '$ionicModal', '$ionicListDelegate', '$ionicSlideBoxDelegate', '$ionicScrollDelegate', '$ionicActionSheet', '$timeout', '$window', 'pdfDelegate',
		function(sdcardConstant, sdcardValue, sdcardUtil, detectMediaTypeUtil, tpService, tpUtil, tpProtocol, homeUtil,
			$scope, $sce, $ionicModal, $ionicListDelegate, $ionicSlideBoxDelegate, $ionicScrollDelegate, $ionicActionSheet, $timeout, $window, pdfDelegate) {
			var sdcard = this;
			var ftpPathManager = sdcardUtil.newFtpPathManager();
			var fileListManager = sdcardUtil.newFileListManager();
			var cacheFileManager = sdcardUtil.cacheFileManager;

			var devicePlatform = tpService.serviceValue.devicePlatform;
			tpService.logService.debug("devicePlatform=" + devicePlatform);

			// device dir
			if (findCordovaPluginFile()) {
				// promise: "Directory" means have prefix "file://", "Dir" means no prefix.
				var documentsDirectory = cordova.file.documentsDirectory;
				var cacheDirectory = cordova.file.cacheDirectory;
				var sdcardCacheNamePart = 'sdcard';
				var sdcardCacheDirectory = cacheDirectory + sdcardCacheNamePart + '/';
				var sdcardCacheDir = sdcardUtil.pathScheme.delete(sdcardCacheDirectory);
				var dataDirectory = cordova.file.dataDirectory;
				var externalDataDirectory = cordova.file.externalDataDirectory;
				var externalRootDirectory = cordova.file.externalRootDirectory;

				tpService.logService.debug("documentsDirectory=" + documentsDirectory);
				tpService.logService.debug("cacheDirectory=" + cacheDirectory);
				tpService.logService.debug("sdcardCacheDirectory=" + sdcardCacheDirectory);
				tpService.logService.debug("sdcardCacheDir=" + sdcardCacheDir);
				tpService.logService.debug("dataDirectory=" + dataDirectory);
				tpService.logService.debug("externalDataDirectory=" + externalDataDirectory);
				tpService.logService.debug("externalRootDirectory=" + externalRootDirectory);

				if (devicePlatform == "Android") {
					var xDataDirectory = externalRootDirectory;
					if (!xDataDirectory) {
						xDataDirectory = externalDataDirectory;
						if (!xDataDirectory) {
							xDataDirectory = dataDirectory;
							if (!xDataDirectory) {
								tpService.logService.error(devicePlatform + ": xDataDirectory is not exist!");
								return;
							}
						}
					}
					var albumNamePart = 'DCIM/' + sdcardConstant.ALBUM_NAME;
					var albumDirectory = xDataDirectory + albumNamePart + '/';
					var albumDir = sdcardUtil.pathScheme.delete(albumDirectory);

					tpService.logService.debug("xDataDirectory=" + xDataDirectory);
					tpService.logService.debug("albumDirectory=" + albumDirectory);
					tpService.logService.debug("albumDir=" + albumDir);
				}
			}

			tpService.modService.initMod($scope, {
				enter: enterCallback,
				beforeLeave: beforeLeaveCallback,
				unloaded: unloadedCallback
			});

			$scope.sdcardConstant = sdcardConstant;
			$scope.sdcardValue = sdcardValue;
			$scope.ftpPathManager = ftpPathManager;
			$scope.fileListManager = fileListManager;

			sdcard.data = {
				local: {
					images: {
						folder: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.FOLDER),
						image: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.IMAGE),
						video: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.VIDEO),
						audio: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.AUDIO),
						text: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.TEXT),
						application: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.APPLICATION),
						other: tpService.modService.getModImgUrl(sdcardConstant.FILE_AVATAR.OTHER)
					},
					connectStatus: sdcardConstant.CONNECT_STATUS.CONNECTING, // always init as connecting!
					isEditing: false, // is editing list?
					selectedCount: 0, // The number of selected items.
					isAllSelected: false, // are all items selected?
					createDirectoryName: '',
					// This is just a file template contains all needed file info. Not used really! Every list item should contain these fields.
					ftpFileTemplate: {
						// file name (utf-8).
						name: "",
						// file name without postfix (utf-8).
						nameWithoutPostfix: "",
						// this field stores file's postfix, like `png`, `mov`... or blank string.
						postfix: "",
						// number `0` means regular file, `1` means directory, `2` means symbolic link, `-1` means unknown type (maybe block dev, char dev...).
						type: sdcardConstant.FILE_TYPE.FILE,
						// if it's regular file, this field store its media type (according to file's postfix), include `image`, `video`, `audio`, `text`, `other`... Refer to `detectMediaTypeUtil`.
						mediaType: sdcardConstant.MEDIA_TYPE.OTHER,
						// `mediaType/postfix` is the mimeType, like `video/mp4`.
						mimeType: "",
						// file's avatar, like `video.png`, `other.png`...
						avatar: "",
						// file's thumbnail. It's the same to localPath currently, and it will be processed by angular-thumbnails to generate thumbnail at runtime.
						thumbnail: "",
						// if the file is a symbolic link, then this field store symbolic link information (utf-8), else it's a blank string.
						link: "",
						// file size in bytes.
						size: 0,
						// file size using human readable unit, like `GB`, `MB`, `KB`, `B`.
						sizeHumanReadable: "0B",
						// modified date of this file. like `2015-12-01 20:45:00 GMT+8`.
						modifiedDate: "",
						// the file's local/cache full path. Normally only `play`, `download` and `upload` action will process this field.
						localPath: "",
						// the file's remote/ftp full path.
						remotePath: "",
						// the file's remote/ftp parent path.
						curPath: "",
						// this is the unique identification of this file at localPath.
						digest: "",
						// [option] if the file is image, then this field store its base64 format.
						base64: ""
					},
					// ftp file list at current path `curPath`.
					list: {
						dir: [],
						file: [],
						image: [],
						video: [],
						audio: [],
						text: [],
						other: [],
						all: []
					},
					// current ftp cmd
					curCmd: {
						cmd: null,
						args: []
					},
					// current ftp action progress
					curProgress: {
						// for efficiency, here we will save string after translated.
						part1: '',
						part2: '',
						// percent
						index: 0,
						count: 0,
						total: 0,
						percent: 0
					},
					settingViewer: {
						accessModes: [{
							type: sdcardConstant.ACCESS_MODE.USB,
							name: "SDCARD.CONTENT.ACCESS_MODE.USB"
						}, {
							type: sdcardConstant.ACCESS_MODE.WIFI,
							name: "SDCARD.CONTENT.ACCESS_MODE.WIFI"
						}],
						modal: null
					},
					setting: {},
					settingBak: {},
					settingTemp: {},
					imageViewer: {
						images: [],
						modal: null,
						index: 0,
						zoomMin: 1,
						zoomMax: 2,
						background: "sdcard-bg-white"
					},
					textViewer: {
						modal: null,
						index: 0,
						title: "",
						content: ""
					},
					applicationViewer: {
						modal: null,
						index: 0,
						title: "",
						url: ""
					},
					curViewer: null
				},
				server: {}
			};
			sdcard.data.local.setting.accessMode = sdcard.data.local.settingViewer.accessModes[0];
			sdcard.data.local.setting.showFilePostfix = tpService.localDataService.getApp('sdcard.setting.showFilePostfix') || false;

			sdcard.action = {
				openEdit: function() {
					$ionicListDelegate.closeOptionButtons();
					// always do deselect all
					sdcard.action.cancelSelectAll();
					sdcard.data.local.isEditing = true;
				},
				closeEdit: function() {
					$ionicListDelegate.closeOptionButtons();
					// always do deselect all
					sdcard.action.cancelSelectAll();
					sdcard.data.local.isEditing = false;
				},
				isAllSelected: function() {
					var list = fileListManager.getAll();
					var isAllSelected = false;
					var j = 0;
					if (list.length) {
						for (var i in list) {
							var file = list[i];
							if (file.checked) {
								j++;
							}
						}
						if (j === list.length) {
							isAllSelected = true;
						} else {
							isAllSelected = false;
						}
					} else {
						isAllSelected = false;
					}
					sdcard.data.local.selectedCount = j;
					sdcard.data.local.isAllSelected = isAllSelected;
					return isAllSelected;
				},
				selectAll: function() {
					fileListManager.getAll().forEach(function(file) {
						file.checked = true;
					});
					sdcard.data.local.isAllSelected = true;
					sdcard.data.local.selectedCount = fileListManager.getAll().length;
				},
				cancelSelectAll: function() {
					fileListManager.getAll().forEach(function(file) {
						file.checked = false;
					});
					sdcard.data.local.isAllSelected = false;
					sdcard.data.local.selectedCount = 0;
				},
				switchSelectAll: function() {
					if (sdcard.data.local.isAllSelected) {
						sdcard.action.cancelSelectAll();
					} else {
						sdcard.action.selectAll();
					}
				},
				connect: function() {
					if (sdcardValue.SIMULATE) {
						return;
					}
					connectFtp();
				},
				refresh: function() {
					if (sdcardValue.SIMULATE) {
						$scope.$broadcast('scroll.refreshComplete');
						return;
					}
					if (sdcard.data.local.connectStatus == sdcardConstant.CONNECT_STATUS.CONNECTED) {
						listDirectory({
							successCallback: function() {
								// Stop the ion-refresher from spinning
								$scope.$broadcast('scroll.refreshComplete');
							},
							failCallback: function() {
								// Stop the ion-refresher from spinning
								$scope.$broadcast('scroll.refreshComplete');
								tpService.promptService.toast.warning('COMMON.CONTENT.REFRESH_FAIL');
							},
							isSilent: true
						});
					} else if (sdcard.data.local.connectStatus == sdcardConstant.CONNECT_STATUS.DISCONNECTED) {
						connectFtp({
							successCallback: function() {
								// Stop the ion-refresher from spinning
								$scope.$broadcast('scroll.refreshComplete');
							},
							failCallback: function() {
								// Stop the ion-refresher from spinning
								$scope.$broadcast('scroll.refreshComplete');
								tpService.promptService.toast.warning('COMMON.CONTENT.REFRESH_FAIL');
							}
						});
					}
				},
				create: function() {
					$ionicListDelegate.closeOptionButtons();
					// Open one window for user to input one new directory name, and create it at ftp current path
					tpService.languageService.translate(['SDCARD.CONTENT.CREATE_DIRECTORY', 'COMMON.CONTENT.OK', 'COMMON.CONTENT.CANCEL'], function(string) {
						$scope.sdcard.data.local.createDirectoryName = '';
						tpService.promptService.popup.showWithOptions({
							scope: $scope,
							title: string['SDCARD.CONTENT.CREATE_DIRECTORY'],
							templateUrl: 'mod-sdcard-createDirectory.html',
							buttons: [{
								text: string['COMMON.CONTENT.CANCEL'],
								type: 'button-default',
							}, {
								text: string['COMMON.CONTENT.OK'],
								type: 'button-positive',
								onTap: function(e) {
									if (!$scope.sdcard.data.local.createDirectoryName) {
										e.preventDefault();
									} else {
										return $scope.sdcard.data.local.createDirectoryName;
									}
								}
							}]
						}, function(res) {
							var input = res;
							tpService.logService.debug("create: dir name=" + input);
							if (input) {
								var remotePath = ftpPathManager.getFullPath(input);
								var allFiles = fileListManager.getAll();
								for (var i in allFiles) {
									var file = allFiles[i];
									if (file.name == input) {
										tpService.promptService.toast.warning('SDCARD.CONTENT.CREATE_DIRECTORY_FAIL_EXIST_FILE');
										return;
									}
								}
								if (sdcardValue.SIMULATE) {
									tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
									return;
								}
								createDirectory(remotePath);
							}
						});
					});
				},
				upload: function() {
					$ionicListDelegate.closeOptionButtons();
					if (sdcardValue.SIMULATE) {
						tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
						return;
					}
					// Open image/video picker window.
					// On Android, user can also pick other file type using "Open from" window.
					// TIP: html tag `<input>` also popup the "Open from" window, and it's quicker! Maybe i will use it to replace cordova plugin in the future.
					if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginCamera()) {
						tpService.logService.warn("upload: plugin not ready");
						return;
					}
					navigator.camera.getPicture(function(mediaURI) {
						tpService.logService.debug("upload: camera: mediaURI=" + mediaURI);
						var file = {};
						file.localPath = sdcardUtil.pathScheme.delete(mediaURI);
						file.name = sdcardUtil.getFilename(file.localPath);
						file.remotePath = ftpPathManager.getFullPath(file.name);
						uploadFile([file], {
							prompt: {
								preventLoadingBar: true
							}
						});
					}, function(error) {
						// TIP: If user cancel pick, will also trigger this error callback.
						tpService.logService.error("upload: camera: error=" + error + ". If the error is triggered by action `cancel`, ignore it.");
					}, {
						sourceType: Camera.PictureSourceType.PHOTOLIBRARY,
						mediaType: Camera.MediaType.ALLMEDIA,
						quality: 100,
						destinationType: Camera.DestinationType.FILE_URI
					});
				},
				share: function(index) {
					tpService.logService.debug("share: index=" + index);
					$ionicListDelegate.closeOptionButtons();
					// the indexs record the files want to share
					var files = [];
					if (angular.isNumber(index)) {
						files.push(fileListManager.getAll(index));
					} else {
						fileListManager.getAll().forEach(function(file, index) {
							if (file.checked === true) {
								if (file.mediaType != sdcardConstant.MEDIA_TYPE.IMAGE) {
									tpService.promptService.toast.warning('SDCARD.CONTENT.JUST_SUPPORT_MEDIA_TYPE.SHARE');
									return;
								}
								files.push(file);
							}
						});
					}
					if (files.length <= 0) {
						tpService.promptService.toast.warning('SDCARD.CONTENT.SELECT_NONE_WARN');
					} else {
						sdcard.action.closeEdit();
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						shareFile(files, {
							prompt: {
								preventLoadingBar: true
							}
						});
					}
				},
				download: function(index) {
					tpService.logService.debug("download: index=" + index);
					$ionicListDelegate.closeOptionButtons();
					// the indexs record the files want to download
					var files = [];
					if (angular.isNumber(index)) {
						files.push(fileListManager.getAll(index));
					} else {
						fileListManager.getAll().forEach(function(file, index) {
							if (file.checked === true) {
								if (file.mediaType != sdcardConstant.MEDIA_TYPE.IMAGE && file.mediaType != sdcardConstant.MEDIA_TYPE.VIDEO) {
									tpService.promptService.toast.warning('SDCARD.CONTENT.JUST_SUPPORT_MEDIA_TYPE.DOWNLOAD');
									return;
								}
								files.push(file);
							}
						});
					}
					if (files.length <= 0) {
						tpService.promptService.toast.warning('SDCARD.CONTENT.SELECT_NONE_WARN');
					} else {
						sdcard.action.closeEdit();
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						// if all files have been cached, no need to show download loading
						var downloadPreventLoading = true;
						for(var i in files) {
							if (!files[i].localPath) {
								downloadPreventLoading = false;
								break;
							}
						}
						downloadFile(files, {
							prompt: {
								preventLoading: downloadPreventLoading,
								preventLoadingBar: true
							}
						});
					}
				},
				save: function(index) {
					tpService.logService.debug("save: index=" + index);
					$ionicListDelegate.closeOptionButtons();
					// the indexs record the files want to save
					var files = [];
					if (angular.isNumber(index)) {
						files.push(fileListManager.getAll(index));
					} else {
						fileListManager.getAll().forEach(function(file, index) {
							if (file.checked === true) {
								if (file.mediaType != sdcardConstant.MEDIA_TYPE.IMAGE && file.mediaType != sdcardConstant.MEDIA_TYPE.VIDEO) {
									tpService.promptService.toast.warning('SDCARD.CONTENT.JUST_SUPPORT_MEDIA_TYPE.SAVE');
									return;
								}
								files.push(file);
							}
						});
					}
					if (files.length <= 0) {
						tpService.promptService.toast.warning('SDCARD.CONTENT.SELECT_NONE_WARN');
					} else {
						sdcard.action.closeEdit();
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						saveFile(files, {
							prompt: {
								preventLoadingBar: true
							}
						});
					}
				},
				//move: move, // TODO: move/rename is not directly supported by ftp cmd currently.
				delete: function(index) {
					tpService.logService.debug("delete: index=" + index);
					$ionicListDelegate.closeOptionButtons();
					var files = [];
					if (angular.isNumber(index)) {
						files.push(fileListManager.getAll(index));
					} else {
						fileListManager.getAll().forEach(function(file, index) {
							if (file.checked === true) {
								files.push(file);
							}
						});
					}
					if (files.length <= 0) {
						tpService.promptService.toast.warning('SDCARD.CONTENT.SELECT_NONE_WARN');
					} else {
						tpService.promptService.popup.confirm('COMMON.CONTENT.DELETE_PROMPT', 'COMMON.CONTENT.DELETE', function callback(isOK) {
							if (isOK) {
								sdcard.action.closeEdit();
								if (sdcardValue.SIMULATE) {
									tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
									return;
								}
								deleteFile(files);
							}
						});
					}
				},
				cancel: cancel,
				// when click one dir, go child path
				// when click one file, play video, audio or show image, text (editable)
				go: function(index) {
					tpService.logService.debug("go: index=" + index);
					$ionicListDelegate.closeOptionButtons();
					var __play = function(file) {
						tpService.linkService.gotoMod('player', {
							playlist: [{
								name: file.name,
								sources: [{
									src: $sce.trustAsResourceUrl(file.localPath),
									type: file.mimeType
								}]
							}],
							autoPlay: true
						}, undefined, function() {
							tpService.logService.warn("go: play mod: not found");
						});
					}
					var _play = function(file) {
						// play it
						if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
							tpService.logService.debug("go: Show image");
							sdcard.action.imageViewer.open(file);
						} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
							tpService.logService.debug("go: Show video");
							__play(file);
						} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.AUDIO) {
							tpService.logService.debug("go: Show audio");
							__play(file);
						} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.TEXT) {
							tpService.logService.debug("go: Show text");
							sdcard.action.textViewer.open(file);
						} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
							tpService.logService.debug("go: Show application");
							sdcard.action.applicationViewer.open(file);
						} else {
							tpService.logService.debug("go: Not supported mediaType");
						}
					}
					var _cacheAndPlay = function(file) {
						if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE ||
							file.mediaType == sdcardConstant.MEDIA_TYPE.OTHER) {
							_play(file);
						} else {
							var preventLoading = false;
							var preventLoadingBar = false;
							if (file.mediaType == sdcardConstant.MEDIA_TYPE.TEXT ||
								file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
								preventLoading = true;
								preventLoadingBar = false;
							} else {
								preventLoading = false;
								preventLoadingBar = true;
							}
							cacheFileManager.get(file, function(file) {
								// already loaded
								// TIP: Yes, downloadFile also find cache at first, but here we want to skip loading to make single file clicked happy
								tpService.logService.info("go: cached localPath=" + file.localPath);
								_play(file);
							}, function(file) {
								// if all files have been cached, no need to show download loading
								var downloadPreventLoading = true;
								if (!file.localPath) {
									downloadPreventLoading = false;
								}
								downloadFile([file], {
									successCallback: function(file) {
										_play(file);
									},
									failCallback: function(file) {
										tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
									},
									prompt: {
										preventLoading: downloadPreventLoading,
										preventLoadingBar: preventLoadingBar,
										preventToast: true
									}
								});
							});
						}
					}

					var file = fileListManager.getAll(index);
					if (file.type == sdcardConstant.FILE_TYPE.DIR) {
						tpService.promptService.loading.show();
						// always success, so no failCallback
						ftpPathManager.goChildPath(file.name, fileListManager.getList(), function(newPath) {
							tpService.logService.debug("go: newPath=" + newPath);
							if (sdcardValue.SIMULATE) {
								tpService.promptService.loading.hide();
								return;
							}
							listDirectory({
								successCallback: function() {
									tpService.promptService.loading.hide();
								},
								failCallback: function() {
									tpService.promptService.loading.hide();
									tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
								}
							});
						});
					} else if (file.type == sdcardConstant.FILE_TYPE.FILE) {
						if (sdcardValue.SIMULATE) {
							_play(file);
							return;
						}
						_cacheAndPlay(file);
					} else {
						tpService.logService.warn("go: not supported file type");
					}
				},
				goBack: goBack,
				settingViewer: {},
				imageViewer: {},
				textViewer: {},
				applicationViewer: {}
			};

			// SDCard Setting Modal
			$ionicModal.fromTemplateUrl('mod-sdcard-settingViewer.html', {
				scope: $scope, // modal has the same $scope from this controller.
				animation: 'slide-in-up'
			}).then(function(modal) {
				sdcard.data.local.settingViewer.modal = modal; // bind this modal to $scope.
			});
			// Some action api capsulation, you can also use sdcard.data.local.settingViewer.modal.xxx directly.
			sdcard.action.settingViewer.countCacheSize = function() {
				tpService.languageService.translate('SDCARD.CONTENT.COUNT_CACHE_SIZE', function(string) {
					sdcard.data.local.setting.cacheSize = string;
					var size = 0;
					if (sdcardValue.SIMULATE) {
						size = homeUtil.formatFlow(0);
						sdcard.data.local.setting.cacheSize = size.flow + size.flowUnit.name;
						return;
					}
					if (!findCordovaPluginFile()) {
						tpService.logService.warn("settingViewer.countCacheSize: plugin not ready");
						return;
					}
					window.resolveLocalFileSystemURL(sdcardCacheDirectory, function(dirEntry) {
						// WARNING: Just list files under sdcardCacheDirectory, and do NOT list child directories recursively!
						var directoryReader = dirEntry.createReader();
						directoryReader.readEntries(function(entries) {
							var i = 0;
							async.whilst(
								function() {
									return i < entries.length;
								},
								function(callback) {
									entries[i].file(function(file) {
										tpService.logService.debug("settingViewer.countCacheSize: i=" + i + ", file.name=" + file.name + ", file.size=" + file.size);
										size += file.size;
										i++;
										callback(null, i);
									});
								},
								function(err, n) {
									tpService.logService.debug("settingViewer.countCacheSize: total raw size=" + size);
									size = homeUtil.formatFlow(size);
									sdcard.data.local.setting.cacheSize = size.flow + size.flowUnit.name;
									tpService.logService.debug("settingViewer.countCacheSize: total human size=" + sdcard.data.local.setting.cacheSize);
								}
							);
						}, function(error) {
							if (error.code != window.FileError.NOT_FOUND_ERR) {
								tpService.logService.error("settingViewer.countCacheSize: directoryReader.readEntries " + sdcardCacheDirectory + " error=" + error.code);
							}
							// not exist, means already cleared
							size = homeUtil.formatFlow(0);
							sdcard.data.local.setting.cacheSize = size.flow + size.flowUnit.name;
						});
					}, function(error) {
						if (error.code != window.FileError.NOT_FOUND_ERR) {
							tpService.logService.error("settingViewer.countCacheSize: resolveLocalFileSystemURL " + sdcardCacheDirectory + " error=" + error.code);
						}
						// not exist, means already cleared
						size = homeUtil.formatFlow(0);
						sdcard.data.local.setting.cacheSize = size.flow + size.flowUnit.name;
					});
				});
			};
			sdcard.action.settingViewer.open = function() {
				sdcard.data.local.settingTemp.accessMode = sdcard.data.local.setting.accessMode;
				sdcard.data.local.settingTemp.showFilePostfix = sdcard.data.local.setting.showFilePostfix;
				sdcard.data.local.settingBak.accessMode = sdcard.data.local.setting.accessMode;
				sdcard.data.local.settingBak.showFilePostfix = sdcard.data.local.setting.showFilePostfix;
				sdcard.data.local.settingViewer.modal.show();
				sdcard.data.local.curViewer = "settingViewer";
				sdcard.action.settingViewer.countCacheSize();
			};
			sdcard.action.settingViewer.cancel = function() {
				sdcard.data.local.setting.showFilePostfix = sdcard.data.local.settingBak.showFilePostfix;
				sdcard.data.local.setting.accessMode = sdcard.data.local.settingBak.accessMode;
				sdcard.data.local.settingViewer.modal.hide();
				// Tip: Won't remove modal until $scope destroy, this will cut the cost of create modal.
			};
			sdcard.action.settingViewer.save = function() {
				if (sdcard.data.local.settingBak.accessMode.type !== sdcard.data.local.settingTemp.accessMode.type) {
					sdcard.data.local.setting.accessMode = sdcard.data.local.settingTemp.accessMode;
					tpService.logService.debug("setting.save: new accessMode type=" + sdcard.data.local.setting.accessMode.type);
					sdcard.data.server.sdcard.mode = sdcard.data.local.setting.accessMode.type;
					sdcard.data.local.connectStatus = sdcardConstant.CONNECT_STATUS.CONNECTING;
					$ionicScrollDelegate.scrollTo(0, 0);
					// save data if need
					saveData(sdcard.data.server.sdcard);
				}
				if (sdcard.data.local.setting.accessMode.type == sdcardConstant.ACCESS_MODE.WIFI) {
					if (!devicePlatform) {
						goSimulateMode();
					}
				}
				sdcard.data.local.settingViewer.modal.hide();
				// Tip: Won't remove modal until $scope destroy, this will cut the cost of create modal.
			};
			sdcard.action.settingViewer.showFilePostfix = function() {
				sdcard.data.local.setting.showFilePostfix = sdcard.data.local.settingTemp.showFilePostfix;
				tpService.localDataService.setApp('sdcard.setting.showFilePostfix', sdcard.data.local.setting.showFilePostfix);
			};
			sdcard.action.settingViewer.clearCache = function() {
				tpService.promptService.popup.confirm('SDCARD.CONTENT.CLEAR_CACHE_PROMPT', 'SDCARD.CONTENT.CLEAR_CACHE', function callback(isOK) {
					if (isOK) {
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						if (!findCordovaPluginFile()) {
							tpService.logService.warn("settingViewer.clearCache: plugin not ready");
							return;
						}
						tpService.promptService.loading.show();
						window.resolveLocalFileSystemURL(sdcardCacheDirectory, function(dirEntry) {
							dirEntry.removeRecursively(function() {
								tpService.logService.info("settingViewer.clearCache: removeRecursively " + sdcardCacheDirectory + " ok");
								sdcard.action.settingViewer.countCacheSize();
								tpService.promptService.loading.hide();
								listDirectory({
									isSilent: true
								});
							}, function(error) {
								tpService.logService.error("settingViewer.clearCache: removeRecursively " + sdcardCacheDirectory + " error=" + error.code);
								sdcard.action.settingViewer.countCacheSize();
								tpService.promptService.loading.hide();
								listDirectory({
									isSilent: true
								});
							});
						}, function(error) {
							if (error.code != window.FileError.NOT_FOUND_ERR) {
								tpService.logService.error("settingViewer.clearCache: resolveLocalFileSystemURL " + sdcardCacheDirectory + " error=" + error.code);
							}
							// not exist, means already cleared
							tpService.promptService.loading.hide();
						});
					}
				});
			};

			// SDCard ImageViewer Modal
			sdcard.action.imageViewer.loadImage = function(index) {
				var file = fileListManager.getImage(index);
				if (file.localPath) {
					// already loaded
					// TIP: Yes, downloadFile also find cache at first, but here we want to skip plugin checking to make SIMULATE mode happy
					tpService.logService.info("imageViewer.loadImage: ok, cached localPath=" + file.localPath);
					sdcard.data.local.imageViewer.images = fileListManager.getImage();
					$ionicSlideBoxDelegate.update();
				} else {
					// FIXME: When ionicModal + ionicLoading, we can not click closeIcon to close loading.
					// Refer to https://github.com/driftyco/ionic/issues/3615
					tpService.promptService.loading.show();
					downloadFile([file], {
						successCallback: function(file) {
							tpService.logService.debug("imageViewer.loadImage: load file ok, localPath=" + file.localPath);
						},
						failCallback: function(file) {
							tpService.logService.debug("imageViewer.loadImage: load file fail, localPath=" + file.localPath);
						},
						doneCallback: function(successFiles) {
							tpService.logService.debug("imageViewer.loadImage: load file end");
							sdcard.data.local.imageViewer.images = [];
							$ionicSlideBoxDelegate.update();
							// update() need some time, so the second update() should do a little later
							$timeout(function() {
								sdcard.data.local.imageViewer.images = fileListManager.getImage();
								$ionicSlideBoxDelegate.update();
								tpService.promptService.loading.hide();
							}, 200);
							if (successFiles.length === 0) {
								tpService.promptService.toast.error("COMMON.CONTENT.LOAD_FAIL");
								return;
							}
						},
						prompt: {
							preventLoading: true,
							preventToast: true
						}
					});
				}
			};
			sdcard.action.imageViewer.open = function(file) {
				sdcard.data.local.imageViewer.images = [];
				sdcard.data.local.imageViewer.index = fileListManager.getIndex(file).image;
				sdcard.data.local.imageViewer.background = "sdcard-bg-white";
				$ionicModal.fromTemplateUrl('mod-sdcard-imageViewer.html', {
					scope: $scope, // modal has the same $scope from this controller.
					animation: 'slide-in-up'
				}).then(function(modal) {
					sdcard.data.local.imageViewer.modal = modal; // bind this modal to $scope.
					sdcard.data.local.imageViewer.modal.show();
					sdcard.data.local.curViewer = "imageViewer";
					sdcard.action.imageViewer.loadImage(sdcard.data.local.imageViewer.index);
				});
			};
			sdcard.action.imageViewer.close = function() {
				sdcard.data.local.imageViewer.modal.hide();
				sdcard.data.local.imageViewer.modal.remove();
				if (window.StatusBar && !StatusBar.isVisible) {
					StatusBar.show();
				}
			};
			sdcard.action.imageViewer.slide = function(index) {
				tpService.logService.debug("imageViewer.slide: to index=" + index);
				sdcard.action.imageViewer.loadImage(index);
			};
			sdcard.action.imageViewer.click = function() {
				if (sdcard.data.local.imageViewer.background == "sdcard-bg-white") {
					sdcard.data.local.imageViewer.background = "sdcard-bg-black";
					if (window.StatusBar && StatusBar.isVisible) {
						StatusBar.hide();
					}
				} else {
					sdcard.data.local.imageViewer.background = "sdcard-bg-white";
					if (window.StatusBar && !StatusBar.isVisible) {
						StatusBar.show();
					}
				}
			};
			sdcard.action.imageViewer.scroll = function() {
				var zoomFactor = $ionicScrollDelegate.$getByHandle('scrollHandle' + sdcard.data.local.imageViewer.index).getScrollPosition().zoom;
				if (zoomFactor == sdcard.data.local.imageViewer.zoomMin) {
					$ionicSlideBoxDelegate.enableSlide(true);
				} else {
					$ionicSlideBoxDelegate.enableSlide(false);
				}
			};
			sdcard.action.imageViewer.share = function() {
				tpService.logService.debug("imageViewer.share");
				if (sdcardValue.SIMULATE) {
					tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
					return;
				}
				shareFile([fileListManager.getImage(sdcard.data.local.imageViewer.index)]);
			};
			sdcard.action.imageViewer.save = function() {
				tpService.logService.debug("imageViewer.save");
				if (sdcardValue.SIMULATE) {
					tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
					return;
				}
				saveFile([fileListManager.getImage(sdcard.data.local.imageViewer.index)]);
			};
			sdcard.action.imageViewer.delete = function() {
				tpService.logService.debug("imageViewer.delete");
				tpService.promptService.popup.confirm('COMMON.CONTENT.DELETE_PROMPT', 'COMMON.CONTENT.DELETE', function callback(isOK) {
					if (isOK) {
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						deleteFile([fileListManager.getImage(sdcard.data.local.imageViewer.index)], {
							successCallback: function() {
								if (fileListManager.getImage().length <= 0) {
									sdcard.action.imageViewer.close();
									return;
								}
								if (sdcard.data.local.imageViewer.index === fileListManager.getImage().length) {
									sdcard.data.local.imageViewer.index--;
								}
								$timeout(function() {
									sdcard.action.imageViewer.loadImage(sdcard.data.local.imageViewer.index);
								}, 300);
							},
							preventUpdateDirectory: true
						});
					}
				});
			};

			// SDCard TextViewer Modal
			sdcard.action.textViewer.open = function(file) {
				tpService.promptService.loading.show();
				// TIP: never to save `sdcard.data.local.textViewer.file = file`,
				// because angular scope will change its child node's fields, then fileListManager will work out of the way.
				sdcard.data.local.textViewer.index = fileListManager.getIndex(file).text;
				sdcard.data.local.textViewer.title = file.name;
				sdcard.data.local.textViewer.titleWithoutPostfix = file.nameWithoutPostfix;
				var showText = function() {
					$ionicModal.fromTemplateUrl('mod-sdcard-textViewer.html', {
						scope: $scope, // modal has the same $scope from this controller.
						animation: 'slide-in-up'
					}).then(function(modal) {
						sdcard.data.local.textViewer.modal = modal; // bind this modal to $scope.
						sdcard.data.local.curViewer = "textViewer";
						sdcard.data.local.textViewer.modal.show();
						if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
							// Refer to: http://localhost:4000/docs/api/page/keyboard/
							// If the content of your app (including the header) is being pushed up and
							// out of view on input focus, try setting cordova.plugins.Keyboard.disableScroll(true).
							// This does not disable scrolling in the Ionic scroll view, rather it
							// disables the native overflow scrolling that happens automatically as a
							// result of focusing on inputs below the keyboard.
							cordova.plugins.Keyboard.disableScroll(true);
						}
						tpService.promptService.loading.hide();
					});
				}
				if (sdcardValue.SIMULATE) {
					tpService.httpService.get(file.localPath, undefined, function(data) {
						sdcard.data.local.textViewer.content = data;
						showText();
					});
					return;
				}
				var filePath = sdcardUtil.pathScheme.add(file.localPath);
				window.resolveLocalFileSystemURL(filePath, function(fileEntry) {
					fileEntry.file(function(file) {
						var reader = new FileReader();
						reader.onload = function(evt) {
							tpService.logService.debug("textViewer.open: read as text: " + evt.target.result);
							if (devicePlatform == "Android") {
								tpService.promptService.toast.info('SDCARD.CONTENT.ENCODING_PROMPT');
							}
							sdcard.data.local.textViewer.content = evt.target.result;
							showText();
						};
						reader.onerror = function(evt) {
							tpService.logService.error("textViewer.open: read " + filePath + " error=" + evt.target.error.code);
							if (evt.target.error.code == window.FileError.ENCODING_ERR) {
								tpService.promptService.toast.warning('SDCARD.CONTENT.ENCODING_PROMPT');
							}
							tpService.promptService.loading.hide();
						};
						reader.readAsText(file);
					}, function(error) {
						tpService.logService.error("textViewer.open: can't find file at local filePath " + filePath + " error=" + error.code);
						tpService.promptService.loading.hide();
					});
				}, function(error) {
					tpService.logService.error("textViewer.open: resolveLocalFileSystemURL local filePath " + filePath + " error=" + error.code);
					tpService.promptService.loading.hide();
				});
			};
			sdcard.action.textViewer.close = function() {
				sdcard.data.local.textViewer.modal.hide();
				if (window.cordova && window.cordova.plugins && window.cordova.plugins.Keyboard) {
					cordova.plugins.Keyboard.disableScroll(false);
				}
				sdcard.data.local.textViewer.modal.remove();
			};
			sdcard.action.textViewer.share = function() {
				tpService.logService.debug("textViewer.share: TODO: share text file");
				if (sdcardValue.SIMULATE) {
					tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
					return;
				}
			};
			sdcard.action.textViewer.save = function() {
				tpService.logService.debug("textViewer.save: TODO: save text file (to local)");
				if (sdcardValue.SIMULATE) {
					tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
					return;
				}
			};
			sdcard.action.textViewer.saveEditAndUpload = function() {
				tpService.logService.debug("textViewer.saveEditAndUpload");
				if (sdcardValue.SIMULATE) {
					tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
					return;
				}
				var file = fileListManager.getText(sdcard.data.local.textViewer.index);
				var filePath = sdcardUtil.pathScheme.add(file.localPath);
				window.resolveLocalFileSystemURL(filePath, function(fileEntry) {
					fileEntry.createWriter(function(writer) {
						writer.onwriteend = function(evt) {
							uploadFile([file], {
								successCallback: function() {
									tpService.promptService.toast.success('COMMON.CONTENT.SAVED');
								},
								failCallback: function() {
									tpService.logService.error("textViewer.saveEditAndUpload: upload fail, localPath=" + file.localPath);
									tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
								},
								prompt: {
									preventLoading: true,
									preventToast: true
								},
								preventUpdateDirectory: true
							});
						};
						writer.onerror = function(error) {
							tpService.logService.error("textViewer.saveEditAndUpload: writer " + filePath + " error=" + error.code);
						}
						writer.write(sdcard.data.local.textViewer.content);
					}, function(error) {
						tpService.logService.error("textViewer.saveEditAndUpload: can't create writer at local filePath " + filePath + " error=" + error.code);
					});
				}, function(error) {
					tpService.logService.error("textViewer.saveEditAndUpload: resolveLocalFileSystemURL local filePath " + filePath + " error=" + error.code);
				});
			};
			sdcard.action.textViewer.delete = function() {
				tpService.logService.debug("textViewer.delete");
				var file = fileListManager.getText(sdcard.data.local.textViewer.index);
				tpService.promptService.popup.confirm('COMMON.CONTENT.DELETE_PROMPT', 'COMMON.CONTENT.DELETE', function callback(isOK) {
					if (isOK) {
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						deleteFile([file], {
							successCallback: function() {
								sdcard.action.textViewer.close();
							}
						});
					}
				});
			};

			// SDCard applicationViewer Modal
			// Note: Just support `.pdf` currently.
			sdcard.action.applicationViewer.prev = function() {
				pdfDelegate.$getByHandle('pdfViewer').prev();
				sdcard.data.local.applicationViewer.currentPage = pdfDelegate.$getByHandle('pdfViewer').getCurrentPage();
			};
			sdcard.action.applicationViewer.next = function() {
				pdfDelegate.$getByHandle('pdfViewer').next();
				sdcard.data.local.applicationViewer.currentPage = pdfDelegate.$getByHandle('pdfViewer').getCurrentPage();
			};
			sdcard.action.applicationViewer.goToPage = function(pageNumber) {
				pdfDelegate.$getByHandle('pdfViewer').goToPage(pageNumber);
				sdcard.data.local.applicationViewer.currentPage = pdfDelegate.$getByHandle('pdfViewer').getCurrentPage();
			};
			sdcard.action.applicationViewer.zoomOut = function(amount) {
				var zoom = 0.1;
				if (angular.isNumber(amount) && amount > 0) {
					zoom = amount;
				}
				pdfDelegate.$getByHandle('pdfViewer').zoomOut(zoom);
			};
			sdcard.action.applicationViewer.zoomIn = function(amount) {
				var zoom = 0.1;
				if (angular.isNumber(amount) && amount > 0) {
					zoom = amount;
				}
				pdfDelegate.$getByHandle('pdfViewer').zoomIn(zoom);
			};
			sdcard.action.applicationViewer.zoomTo = function(amount) {
				var zoom = 1;
				if (angular.isNumber(amount) && amount > 0) {
					zoom = amount;
				}
				pdfDelegate.$getByHandle('pdfViewer').zoomTo(zoom);
			};
			sdcard.action.applicationViewer.fit = function() {
				pdfDelegate.$getByHandle('pdfViewer').fit();
			};
			sdcard.action.applicationViewer.open = function(file) {
				tpService.promptService.loading.show();
				sdcard.data.local.applicationViewer.index = fileListManager.getIndex(file).application;
				sdcard.data.local.applicationViewer.title = file.name;
				sdcard.data.local.applicationViewer.titleWithoutPostfix = file.nameWithoutPostfix;
				sdcard.data.local.applicationViewer.url = file.localPath;
				$ionicModal.fromTemplateUrl('mod-sdcard-applicationViewer.html', {
					scope: $scope, // modal has the same $scope from this controller.
					animation: 'slide-in-up'
				}).then(function(modal) {
					sdcard.data.local.applicationViewer.modal = modal; // bind this modal to $scope.
					sdcard.data.local.applicationViewer.modal.show();
					sdcard.data.local.curViewer = "applicationViewer";
					pdfDelegate.$getByHandle('pdfViewer')
						.load(sdcard.data.local.applicationViewer.url)
						.then(function() {
							sdcard.data.local.applicationViewer.pageCount = pdfDelegate.$getByHandle('pdfViewer').getPageCount();
							sdcard.data.local.applicationViewer.currentPage = pdfDelegate.$getByHandle('pdfViewer').getCurrentPage() || 1;
							tpService.promptService.loading.hide();
						})
						.catch(function() {
							tpService.promptService.toast.error("COMMON.CONTENT.LOAD_FAIL");
							tpService.promptService.loading.hide();
						});
				});
			};
			sdcard.action.applicationViewer.close = function() {
				sdcard.data.local.applicationViewer.modal.hide();
				sdcard.data.local.applicationViewer.modal.remove();
			};
			sdcard.action.applicationViewer.delete = function() {
				tpService.logService.debug("applicationViewer.delete");
				var file = fileListManager.getApplication(sdcard.data.local.applicationViewer.index);
				tpService.promptService.popup.confirm('COMMON.CONTENT.DELETE_PROMPT', 'COMMON.CONTENT.DELETE', function callback(isOK) {
					if (isOK) {
						if (sdcardValue.SIMULATE) {
							tpService.promptService.toast.warning("SIMULATE mode: this action is unusable!");
							return;
						}
						deleteFile([file], {
							successCallback: function() {
								sdcard.action.applicationViewer.close();
							}
						});
					}
				});
			};

			// Execute action on show modal
			$scope.$on('modal.shown', function() {
				if (sdcard.data.local.curViewer == "settingViewer") {
					tpService.logService.debug("modal.shown: settingViewer");
				} else if (sdcard.data.local.curViewer == "imageViewer") {
					tpService.logService.debug("modal.shown: imageViewer");
				} else if (sdcard.data.local.curViewer == "textViewer") {
					tpService.logService.debug("modal.shown: textViewer");
				} else if (sdcard.data.local.curViewer == "applicationViewer") {
					tpService.logService.debug("modal.shown: applicationViewer");
				} else {
					tpService.logService.debug("modal.shown: unknown");
				}
			});
			// Execute action on hide modal
			$scope.$on('modal.hidden', function() {
				if (sdcard.data.local.curViewer == "settingViewer") {
					tpService.logService.debug("modal.hidden: settingViewer");
				} else if (sdcard.data.local.curViewer == "imageViewer") {
					tpService.logService.debug("modal.hidden: imageViewer");
				} else if (sdcard.data.local.curViewer == "textViewer") {
					tpService.logService.debug("modal.hidden: textViewer");
				} else if (sdcard.data.local.curViewer == "applicationViewer") {
					tpService.logService.debug("modal.hidden: applicationViewer");
				} else {
					tpService.logService.debug("modal.hidden: unknown");
				}
			});
			// Execute action on remove modal
			$scope.$on('modal.removed', function() {
				if (sdcard.data.local.curViewer == "settingViewer") {
					tpService.logService.debug("modal.removed: settingViewer");
				} else if (sdcard.data.local.curViewer == "imageViewer") {
					tpService.logService.debug("modal.removed: imageViewer");
				} else if (sdcard.data.local.curViewer == "textViewer") {
					tpService.logService.debug("modal.removed: textViewer");
				} else if (sdcard.data.local.curViewer == "applicationViewer") {
					tpService.logService.debug("modal.removed: applicationViewer");
				} else {
					tpService.logService.debug("modal.removed: unknown");
				}
			});

			var updateView = {
				sdcard: function(data) {
					sdcard.data.server.sdcard = data;
					sdcard.data.local.setting.accessMode = sdcard.data.local.settingViewer.accessModes[data.mode];
					if (data.login === 0) {
						sdcardValue.FTP_ACCOUNT.USERNAME = data.username;
						sdcardValue.FTP_ACCOUNT.PASSWORD = data.password;
					}
					if (sdcard.data.local.setting.accessMode.type == sdcardConstant.ACCESS_MODE.WIFI) {
						// Wi-Fi mode
						if (sdcard.data.local.connectStatus != sdcardConstant.CONNECT_STATUS.CONNECTED) {
							connectFtp();
						}
					} else {
						// USB mode
						sdcard.data.local.connectStatus = sdcardConstant.CONNECT_STATUS.CONNECTED;
						//tpService.promptService.loading.hide();
					}
				}
			};

			function initSimulateData() {
				// Some TEST data.
				var fileList = [{
					name: "folder1",
					type: sdcardConstant.FILE_TYPE.DIR,
					thumbnail: "",
					link: "",
					size: 64,
					modifiedDate: "2015-01-01 01:01:01 GMT+8",
					localPath: ""
				}, {
					name: "folder2",
					type: sdcardConstant.FILE_TYPE.DIR,
					thumbnail: "",
					link: "",
					size: 64,
					modifiedDate: "2015-02-02 02:02:02 GMT+8",
					localPath: ""
				}, {
					name: "textfile1.txt",
					type: sdcardConstant.FILE_TYPE.FILE,
					thumbnail: "",
					link: "",
					size: 43,
					modifiedDate: "2015-01-01 01:01:01 GMT+8",
					localPath: "mod/test/assets/texts/textfile1.txt"
				}, {
					name: "textfile2asdf123asdf123asdf123asdf123.TXT",
					type: sdcardConstant.FILE_TYPE.FILE,
					thumbnail: "",
					link: "",
					size: 10,
					modifiedDate: "2015-02-02 02:02:02 GMT+8",
					localPath: "mod/test/assets/texts/textfile2asdf123asdf123asdf123asdf123.TXT"
				}, {
					name: "poster.png",
					type: sdcardConstant.FILE_TYPE.FILE,
					thumbnail: "mod/test/assets/images/poster.png",
					link: "",
					size: 398107,
					modifiedDate: "2015-03-03 03:03:03 GMT+8",
					localPath: "mod/test/assets/images/poster.png"
				}, {
					name: "mov-8MB-480P.mov",
					type: sdcardConstant.FILE_TYPE.FILE,
					//thumbnail: "mod/test/assets/videos/mov-8MB-480P.mov",
					link: "",
					size: 8438747,
					modifiedDate: "2015-11-11 11:11:11 GMT+8",
					localPath: "mod/test/assets/videos/mov-8MB-480P.mov"
				}, {
					name: "sunshine-girl.mp3",
					type: sdcardConstant.FILE_TYPE.FILE,
					thumbnail: "",
					link: "",
					size: 2783921,
					modifiedDate: "2015-12-12 12:12:12 GMT+8",
					localPath: "mod/test/assets/audios/sunshine-girl.mp3"
				}, {
					name: "lilin.jpeg",
					type: sdcardConstant.FILE_TYPE.FILE,
					thumbnail: "mod/test/assets/images/lilin.jpeg",
					link: "",
					size: 85367,
					modifiedDate: "2015-03-03 03:03:03 GMT+8",
					localPath: "mod/test/assets/images/lilin.jpeg"
				}, {
					name: "Kanon.pdf",
					type: sdcardConstant.FILE_TYPE.FILE,
					thumbnail: "mod/test/assets/applications/Kanon.pdf",
					link: "",
					size: 148901,
					modifiedDate: "2015-12-12 12:12:12 GMT+8",
					localPath: "mod/test/assets/applications/Kanon.pdf"
				}, {
					name: "mp4-10MB-720P.mp4",
					type: sdcardConstant.FILE_TYPE.FILE,
					//thumbnail: "mod/test/assets/videos/mp4-10MB-720P.mp4",
					link: "",
					size: 11824902,
					modifiedDate: "2015-12-20 20:20:20 GMT+8",
					localPath: "mod/test/assets/videos/mp4-10MB-720P.mp4"
				}];
				initFileList(fileList);
			}

			function goSimulateMode() {
				sdcardValue.SIMULATE = true;
				tpService.promptService.toast.warning("Go into SIMULATE mode. Some actions are unusable!");
				initSimulateData();
				sdcard.data.local.connectStatus = sdcardConstant.CONNECT_STATUS.CONNECTED;
			}

			function enterCallback() {
				tpService.linkService.preventAutoJumpWhenError();
				tpService.linkService.registerBackButtonAction(goBack);
				if (!devicePlatform) {
					goSimulateMode();
				}
				requestData();
			}

			function beforeLeaveCallback() {
				tpService.linkService.allowAutoJumpWhenError();
				tpService.linkService.unregisterBackButtonAction(goBack);
			}

			function unloadedCallback() {
				// Cleanup the modal when we're done with it!
				if (sdcard.data.local.settingViewer.modal) {
					sdcard.data.local.settingViewer.modal.remove();
				}
				if (sdcard.data.local.imageViewer.modal) {
					sdcard.data.local.imageViewer.modal.remove();
				}
				if (sdcard.data.local.textViewer.modal) {
					sdcard.data.local.textViewer.modal.remove();
				}
				if (sdcard.data.local.applicationViewer.modal) {
					sdcard.data.local.applicationViewer.modal.remove();
				}
			}

			function goBack() {
				$ionicListDelegate.closeOptionButtons();
				if (ftpPathManager.isAtFtpHomePath()) {
					tpService.linkService._goBack();
				} else {
					tpService.promptService.loading.show();
					ftpPathManager.goParentPath(function(newPath, fileList) {
						tpService.logService.debug("goBack: newPath=" + newPath);
						// Tip: set big list will cost some time, use loading transition
						fileListManager.setList(fileList);
						tpService.promptService.loading.hide();
						//listDirectory();
					});
				}
			}

			function requestData() {
				//tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: 'storageShare',
					action: 0,
					callback: function(data) {
						//tpService.promptService.loading.hide();
						if (!data || data.result !== 0) {
							//tpService.promptService.toast.error('COMMON.CONTENT.LOAD_FAIL');
							return;
						}
						updateView.sdcard(data);
					}
				});
			}

			function saveData(data) {
				tpService.promptService.loading.show();
				tpService.serverDataService.request({
					module: 'storageShare',
					action: 1,
					data: data,
					callback: function(data) {
						tpService.promptService.loading.hide();
						if (data && data.result === 0) {
							//tpService.promptService.toast.success('COMMON.CONTENT.SAVED');
						} else {
							tpService.promptService.toast.error('COMMON.CONTENT.SAVE_FAIL');
						}
						requestData();
					}
				});
			}

			// Find cordova plugin ftp
			function findCordovaPluginFtp() {
				if (!window.cordova || !window.cordova.plugin || !window.cordova.plugin.ftp) {
					tpService.logService.warn("ftp: plugin not found");
					return false;
				} else {
					return true;
				}
			}

			// Find cordova plugin camera
			function findCordovaPluginCamera() {
				if (!navigator.camera) {
					tpService.logService.warn("camera: plugin not found");
					return false;
				} else {
					return true;
				}
			}

			// Find cordova plugin file
			function findCordovaPluginFile() {
				if (!window.cordova || !window.cordova.file) {
					tpService.logService.warn("file: plugin not found");
					return false;
				} else {
					return true;
				}
			}

			// Find cordova plugin device
			function findCordovaPluginDevice() {
				if (!window.device) {
					tpService.logService.warn("device: plugin not found");
					return false;
				} else {
					return true;
				}
			}

			// Find cordova plugin LibraryHelper
			function findCordovaPluginLibraryHelper() {
				if (!window.LibraryHelper) {
					tpService.logService.warn("LibraryHelper: plugin not found");
					return false;
				} else {
					return true;
				}
			}

			// Find cordova plugin cordova-plugin-x-socialsharing
			function findCordovaPluginXSocialSharing() {
				if (!window.plugins || !window.plugins.socialsharing) {
					tpService.logService.warn("socialsharing: plugin not found");
					return false;
				} else {
					return true;
				}
			}

			function getOptions(options) {
				var opts = angular.extend({
					successCallback: angular.noop,
					failCallback: angular.noop,
					doneCallback: angular.noop,
					prompt: {
						preventLoading: false,
						preventLoadingBar: false,
						preventToast: false,
					},
					isSilent: false,
					preventUpdateDirectory: false
				}, options);

				if (opts.isSilent) {
					opts.prompt.preventLoading = true;
					opts.prompt.preventLoadingBar = true;
					opts.prompt.preventToast = true;
				}

				return opts;
			}

			// Connect to ftp server
			function connectFtp(options) {
				if (!findCordovaPluginFtp()) {
					tpService.logService.warn("connectFtp: plugin not ready");
					return;
				}

				var opts = getOptions(options);

				// For iOS, ftp.connect will always success (even if username and password are incorrect),
				// but it does NOT mean the later actions, e.g. ls, download... will success too! So check their errorCallback carefully.
				if (!opts.prompt.preventLoading) {
					tpService.promptService.loading.show();
				}

				var serverInfo = {
					address: tpService.serviceValue.serverAddress,
					username: sdcardValue.FTP_ACCOUNT.USERNAME,
					password: sdcardValue.FTP_ACCOUNT.PASSWORD
				};
				cordova.plugin.ftp.connect(serverInfo.address, serverInfo.username, serverInfo.password, function(ok) {
					listDirectory({
						successCallback: function(ok) {
							tpService.logService.info("connectFtp: ftp.connect: listDirectory ok=" + ok);
							if (!opts.prompt.preventLoading) {
								tpService.promptService.loading.hide();
							}
							if (angular.isFunction(opts.successCallback)) {
								opts.successCallback(ok);
							}
						},
						failCallback: function(error) {
							tpService.logService.error("connectFtp: ftp.connect: listDirectory error=" + error);
							if (!opts.prompt.preventLoading) {
								tpService.promptService.loading.hide();
							}
							if (angular.isFunction(opts.failCallback)) {
								opts.failCallback(error);
							}
						},
						prompt: opts.prompt,
						isSilent: opts.isSilent,
						preventUpdateDirectory: opts.preventUpdateDirectory
					});
				}, function(error) {
					tpService.logService.error("connectFtp: ftp.connect error=" + error);
					if (!opts.prompt.preventLoading) {
						tpService.promptService.loading.hide();
					}
					if (angular.isFunction(opts.failCallback)) {
						opts.failCallback(error);
					}
				});
			}

			// List all files in path
			// WARNING: It will lose some localFile's fields, e.g. localPath
			function listDirectory(options) {
				// Tip: don't judge connect status!
				if (!findCordovaPluginFtp()) {
					tpService.logService.warn("listDirectory: plugin not ready");
					return;
				}

				var opts = getOptions(options);

				if (opts.preventUpdateDirectory) {
					tpService.logService.debug("listDirectory: preventUpdateDirectory, do nothing.");
					return;
				}

				// list one dir, note that just can be dir, not file
				if (!opts.isSilent) {
					sdcard.data.local.connectStatus = sdcardConstant.CONNECT_STATUS.CONNECTING;
				}
				if (!opts.prompt.preventLoading) {
					tpService.promptService.loading.show();
				}

				var path = ftpPathManager.getCurPath();
				cordova.plugin.ftp.ls(path, function(fileList) {
					tpService.logService.info("listDirectory: ftp.ls " + path + " ok");
					initFileList(fileList);
					sdcard.data.local.connectStatus = sdcardConstant.CONNECT_STATUS.CONNECTED;
					var allFiles = fileListManager.getList().all;
					if (!opts.prompt.preventLoading) {
						tpService.promptService.loading.hide();
					}
					if (angular.isFunction(opts.successCallback)) {
						opts.successCallback(path, allFiles);
					}
				}, function(error) {
					tpService.logService.error("listDirectory: ftp.ls " + path + " error=" + error);
					sdcard.data.local.connectStatus = sdcardConstant.CONNECT_STATUS.DISCONNECTED;
					if (!opts.prompt.preventLoading) {
						tpService.promptService.loading.hide();
					}
					if (angular.isFunction(opts.failCallback)) {
						opts.failCallback(path, error);
					}
					// if fail, try reconnect
					connectFtp({
						isSilent: true,
						preventUpdateDirectory: true
					});
				});
			}

			function initFileList(fileList) {
				tpService.logService.debug("initFileList: current path=" + ftpPathManager.getCurPath());
				var _fileListManager = sdcardUtil.newFileListManager();
				if (fileList && fileList.length > 0) {
					for (var i in fileList) {
						var file = fileList[i];
						file.modifiedDate = file.modifiedDate.substring(0, 19); // just need date and time, not timezore
						file.curPath = ftpPathManager.getCurPath();
						//file.localPath = null;
						file.remotePath = ftpPathManager.getFullPath(file.name);
						// Judge file type and media type
						if (file.type == sdcardConstant.FILE_TYPE.FILE) { // file
							var nameAndPostfix = detectMediaTypeUtil.detectNameAndPostfix(file.name);
							file.nameWithoutPostfix = nameAndPostfix.name;
							file.postfix = nameAndPostfix.postfix;
							file.mediaType = detectMediaTypeUtil.detectMediaTypeFromPostfix(file.postfix);
							file.mimeType = file.mediaType + "/" + file.postfix;
							if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
								file.avatar = sdcard.data.local.images.image;
							} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
								file.avatar = sdcard.data.local.images.video;
							} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.AUDIO) {
								file.avatar = sdcard.data.local.images.audio;
							} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.TEXT) {
								file.avatar = sdcard.data.local.images.text;
							} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
								file.avatar = sdcard.data.local.images.application;
							} else {
								file.avatar = sdcard.data.local.images.other;
							}
							// Convert size unit
							if (file.size >= 1024 * 1024 * 1024) {
								file.sizeHumanReadable = tpUtil.flowUtil.ByteToGB(file.size) + "GB";
							} else if (file.size >= 1024 * 1024) {
								file.sizeHumanReadable = tpUtil.flowUtil.ByteToMB(file.size) + "MB";
							} else if (file.size >= 1024) {
								file.sizeHumanReadable = tpUtil.flowUtil.ByteToKB(file.size) + "KB";
							} else {
								file.sizeHumanReadable = file.size + "Bytes";
							}
						} else if (file.type == sdcardConstant.FILE_TYPE.DIR) { // dir
							file.avatar = sdcard.data.local.images.folder;
							file.nameWithoutPostfix = file.name;
							file.sizeHumanReadable = ""; // Here folder does not show any size, because ftp server won't return the total size of files in one folder directly.
						} else { // other
							// Tip: Should never reach here for most sdcard file system
							file.avatar = sdcard.data.local.images.other;
							file.nameWithoutPostfix = file.name;
							file.sizeHumanReadable = ""; // other file should not show any size
						}
						file.digest = sdcardUtil.digestFile(file);
						_fileListManager.add(file);
					}
					_fileListManager.sort();
				}
				fileListManager.setList(_fileListManager.getList());
				var allFiles = fileListManager.getList().all;
				updateThumbnails(allFiles);
			}

			function updateThumbnails(files) {
				for (var i in files) {
					updateThumbnail(files[i]);
				}
			}

			function updateThumbnail(file) {
				if (!file.thumbnail) {
					cacheFileManager.get(file, function(file) {
						if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE || file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
							// Use angular-thumbnails to get thumbnail of image and pdf
							file.thumbnail = file.localPath;
							// update file list
							fileListManager.updateFile(file);
						} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
							// Use cordova-library-helper to get thumbnail of video
							if (!findCordovaPluginLibraryHelper()) {
								tpService.logService.warn("updateThumbnail: plugin not ready");
								return;
							}
							LibraryHelper.getVideoInfo(function(results) {
								tpService.logService.debug("updateThumbnail: getVideoInfo: video Duration: " + results.duration);
								tpService.logService.debug("updateThumbnail: getVideoInfo: video Thumbnail path on disk: " + results.thumbnail);
								window.resolveLocalFileSystemURL(cacheDirectory, function(dirEntry) {
									dirEntry.getDirectory(sdcardCacheNamePart, {
										create: true,
										exclusive: false
									}, function(dirEntry) {
										var thumbnailFile = sdcardUtil.pathScheme.add(results.thumbnail);
										window.resolveLocalFileSystemURL(thumbnailFile, function(fileEntry) {
											var filePath = sdcardCacheDir + fileEntry.name;
											fileEntry.moveTo(dirEntry, fileEntry.name, function(ok) {
												tpService.logService.info("updateThumbnail: move " + results.thumbnail + " to " + filePath + " ok=" + ok);
												file.thumbnail = filePath;
												// update file list
												fileListManager.updateFile(file);
											}, function(error) {
												tpService.logService.error("updateThumbnail: move " + results.thumbnail + " to " + filePath + " error=" + error.code);
											});
										}, function(error) {
											tpService.logService.error("updateThumbnail: resolveLocalFileSystemURL " + thumbnailFile + " error=" + error.code);
										});
									}, function(error) {
										tpService.logService.error("updateThumbnail: getDirectory " + sdcardCacheDir + " error=" + error.code);
									});
								}, function(error) {
									tpService.logService.error("updateThumbnail: resolveLocalFileSystemURL " + cacheDirectory + " error=" + error.code);
								});
							}, function(error) {
								tpService.logService.error("updateThumbnail: getVideoInfo: error=" + error);
							}, file.localPath);
						} else {
							// Not supported
							tpService.logService.warn("updateThumbnail: Not supported mediaType=" + file.mediaType);
						}
					});
				}
			}

			// Create one path at ftp current path
			function createDirectory(remotePath, options) {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginFtp()) {
					tpService.logService.warn("createDirectory: plugin not ready");
					return;
				}

				if (!remotePath) {
					tpService.logService.warn("createDirectory: please give one remotePath");
					return;
				}

				var opts = getOptions(options);

				cordova.plugin.ftp.mkdir(remotePath, function(ok) {
					tpService.logService.info("createDirectory: ftp.mkdir " + remotePath + " ok=" + ok);
					if (angular.isFunction(opts.successCallback)) {
						opts.successCallback(remotePath, ok);
					}
					listDirectory({
						prompt: opts.prompt,
						isSilent: opts.isSilent
					});
				}, function(error) {
					tpService.logService.error("createDirectory: ftp.mkdir " + remotePath + " error=" + error);
					if (!opts.prompt.preventToast) {
						tpService.promptService.toast.error('SDCARD.CONTENT.CREATE_DIRECTORY_FAIL');
					}
					if (angular.isFunction(opts.failCallback)) {
						opts.failCallback(remotePath, error);
					}
					// if fail, try reconnect
					connectFtp({
						isSilent: true,
						preventUpdateDirectory: true
					});
				});
			}

			// Upload local files to ftp current path
			function uploadFile(files, options) {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginFtp() || !findCordovaPluginFile()) {
					tpService.logService.warn("uploadFile: plugin not ready");
					return;
				}

				if (!files || files.length <= 0) {
					tpService.logService.warn("uploadFile: please select at least one valid file");
					return;
				}

				var opts = getOptions(options);

				sdcard.data.local.curCmd.cmd = sdcard.action.upload;
				sdcard.data.local.curProgress.total = files.length;
				sdcard.data.local.curProgress.count = 1;
				sdcard.data.local.curProgress.index = 0;
				sdcard.data.local.curProgress.percent = 0;
				var successFiles = [];
				var file;

				tpService.languageService.translate(['SDCARD.CONTENT.UPLOAD_PERCENT.PART1', 'SDCARD.CONTENT.UPLOAD_PERCENT.PART2'], function(string) {
					sdcard.data.local.curProgress.part1 = string['SDCARD.CONTENT.UPLOAD_PERCENT.PART1'];
					sdcard.data.local.curProgress.part2 = string['SDCARD.CONTENT.UPLOAD_PERCENT.PART2'];

					if (!opts.prompt.preventLoading) {
						tpService.promptService.loading.showWithOptions({
							templateUrl: 'mod-sdcard-progress.html',
							duration: undefined,
							scope: $scope
						});
					}

					// do action one by one
					async.doWhilst(
						function(asyncCallback) {
							file = files[sdcard.data.local.curProgress.index];
							tpService.logService.debug("uploadFile: async.doWhilst: index=" + sdcard.data.local.curProgress.index);
							// private namespace to make those asynchronous callback happy
							(function(file) {
								var oldPercent = 0;
								if (!opts.prompt.preventLoadingBar) {
									tpService.promptService.loadingBar.start();
								}
								// Upload local file to remote
								cordova.plugin.ftp.upload(file.localPath, file.remotePath, function(percent) {
									if (percent == 1) {
										tpService.logService.info("uploadFile: ftp.upload local " + file.localPath + " to remote " + file.remotePath + " finish");
										if (!opts.prompt.preventLoadingBar) {
											tpService.promptService.loadingBar.complete();
										}
										sdcard.data.local.curProgress.percent = 100;

										// update thumbnail
										updateThumbnail(file);

										successFiles.push(file);
										if (!opts.prompt.preventToast) {
											tpService.languageService.translate('SDCARD.CONTENT.UPLOAD_OK', function(string) {
												tpService.promptService.toast.success(string + file.name);
											});
										}
										if (angular.isFunction(opts.successCallback)) {
											opts.successCallback(file);
										}
										if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
											sdcard.data.local.curProgress.count++;
										}
										sdcard.data.local.curProgress.index++;
										asyncCallback(null, sdcard.data.local.curProgress.index - 1);
									} else {
										tpService.logService.debug("uploadFile: ftp.upload local " + file.localPath + " percent=" + percent * 100 + "%");
										if (percent >= oldPercent + 0.01) {
											if (!opts.prompt.preventLoadingBar) {
												tpService.promptService.loadingBar.set(percent);
											}
											sdcard.data.local.curProgress.percent = tpUtil.cutUtil.truncate(percent * 100, 0);
											$scope.$apply(); // update scope immediately
											oldPercent = percent;
										}
										sdcard.data.local.curCmd.args = [file.localPath, file.remotePath];
									}
								}, function(error) {
									tpService.logService.error("uploadFile: ftp.upload local " + file.localPath + " error=" + error);
									if (!opts.prompt.preventLoadingBar) {
										tpService.promptService.loadingBar.complete();
									}
									if (!opts.prompt.preventToast) {
										tpService.languageService.translate('SDCARD.CONTENT.UPLOAD_FAIL', function(string) {
											tpService.promptService.toast.error(string + file.name);
										});
									}
									if (angular.isFunction(opts.failCallback)) {
										opts.failCallback(file, error);
									}
									if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
										sdcard.data.local.curProgress.count++;
									}
									sdcard.data.local.curProgress.index++;
									asyncCallback(null, sdcard.data.local.curProgress.index - 1);
								});
							})(file);
						},
						function() {
							return sdcard.data.local.curProgress.index < sdcard.data.local.curProgress.total;
						},
						function(err, n) {
							if (!opts.prompt.preventLoading) {
								tpService.promptService.loading.hide();
							}
							if (angular.isFunction(opts.doneCallback)) {
								opts.doneCallback(successFiles);
							}
							if (successFiles.length < sdcard.data.local.curProgress.total) {
								// if some fail, try reconnect
								connectFtp({
									isSilent: true,
									// some actions want to retain localFile fields, e.g. file.localPath, so prevent reconnect and listDirectory.
									preventUpdateDirectory: opts.preventUpdateDirectory
								});
							} else {
								listDirectory({
									prompt: opts.prompt,
									isSilent: opts.isSilent,
									// some actions want to retain localFile fields, e.g. file.localPath, so prevent reconnect and listDirectory.
									preventUpdateDirectory: opts.preventUpdateDirectory
								});
							}
						}
					);
				});
			}

			// Download one file or multiple checked files at current path to local system.
			//
			// All file will be downloaded to cacheDirectory (iOS & Android).
			//
			// For more info about File System Layout, Refer to: https://github.com/apache/cordova-plugin-file
			//
			// NOTICE: At the best condition, we will support download all media type,
			//         but on iOS, the file type except for image and video, are stored to documentsDirectory, which is useless to user,
			//         so we will just support image and video currently.
			//
			// TODO: Make a difference between iOS and Android, for download file type.
			//       I mean we can save other file type except for image and video, to dataDirectory on Android.
			function downloadFile(files, options) {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginFtp() || !findCordovaPluginFile()) {
					tpService.logService.warn("downloadFile: plugin not ready");
					return;
				}

				if (!files || files.length <= 0) {
					tpService.logService.warn("downloadFile: please select at least one valid file");
					return;
				}

				var opts = getOptions(options);

				window.resolveLocalFileSystemURL(cacheDirectory, function(dirEntry) {
					// Get or Create sdcard cache dir under app cache path: "/data/user/0/com.tplink.tpmifix/cache/sdcard/"
					dirEntry.getDirectory(sdcardCacheNamePart, {
						create: true,
						exclusive: false
					}, function(dirEntry) {
						tpService.logService.debug("downloadFile: ftp.download: sdcardCacheDir=" + sdcardCacheDir);

						sdcard.data.local.curCmd.cmd = sdcard.action.download;
						sdcard.data.local.curProgress.total = files.length;
						sdcard.data.local.curProgress.count = 1;
						sdcard.data.local.curProgress.index = 0;
						sdcard.data.local.curProgress.percent = 0;
						var successFiles = [];
						var file;

						tpService.languageService.translate(['SDCARD.CONTENT.DOWNLOAD_PERCENT.PART1', 'SDCARD.CONTENT.DOWNLOAD_PERCENT.PART2'], function(string) {
							sdcard.data.local.curProgress.part1 = string['SDCARD.CONTENT.DOWNLOAD_PERCENT.PART1'];
							sdcard.data.local.curProgress.part2 = string['SDCARD.CONTENT.DOWNLOAD_PERCENT.PART2'];

							if (!opts.prompt.preventLoading) {
								tpService.promptService.loading.showWithOptions({
									templateUrl: 'mod-sdcard-progress.html',
									duration: undefined,
									scope: $scope
								});
							}

							// do action one by one
							async.doWhilst(
								function(asyncCallback) {
									file = files[sdcard.data.local.curProgress.index];
									tpService.logService.debug("downloadFile: async.doWhilst: index=" + sdcard.data.local.curProgress.index);
									// private namespace to make those asynchronous callback happy
									(function(file) {
										cacheFileManager.get(file, function(file) {
											// find the file in cache
											tpService.logService.info("downloadFile: find cache file " + file.localPath + ", skip this download.");
											successFiles.push(file);
											if (angular.isFunction(opts.successCallback)) {
												opts.successCallback(file);
											}
											if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
												sdcard.data.local.curProgress.count++;
											}
											sdcard.data.local.curProgress.index++;
											asyncCallback(null, sdcard.data.local.curProgress.index - 1);
										}, function(file) {
											// local path
											var localPath;
											if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
												// TIP: we add digest part as file name's prefix, which fix the name conflict ("cdv_photo_xxx") from cordova.plugin.camera on iOS.
												localPath = sdcardCacheDir + file.digest.substr(0, 6) + '_' + file.name;
											} else {
												localPath = sdcardCacheDir + file.name;
											}
											var oldPercent = 0;
											if (!opts.prompt.preventLoadingBar) {
												tpService.promptService.loadingBar.start();
											}
											// Download remote file to local
											cordova.plugin.ftp.download(localPath, file.remotePath, function(percent) {
												if (percent == 1) {
													file.localPath = localPath;
													tpService.logService.info("downloadFile: ftp.download remote " + file.remotePath + " to local " + file.localPath + " finish");
													if (!opts.prompt.preventLoadingBar) {
														tpService.promptService.loadingBar.complete();
													}
													sdcard.data.local.curProgress.percent = 100;

													// update cache (add file.localPath)
													cacheFileManager.set(file);
													// update file list (add file.localPath)
													fileListManager.updateFile(file);
													// update thumbnail
													updateThumbnail(file);

													successFiles.push(file);
													if (!opts.prompt.preventToast) {
														tpService.languageService.translate('SDCARD.CONTENT.DOWNLOAD_OK', function(string) {
															tpService.promptService.toast.success(string + file.name);
														});
													}
													if (angular.isFunction(opts.successCallback)) {
														opts.successCallback(file);
													}
													if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
														sdcard.data.local.curProgress.count++;
													}
													sdcard.data.local.curProgress.index++;
													asyncCallback(null, sdcard.data.local.curProgress.index - 1);
												} else {
													tpService.logService.debug("downloadFile: ftp.download remote " + file.remotePath + " percent=" + percent * 100 + "%");
													if (percent >= oldPercent + 0.01) {
														if (!opts.prompt.preventLoadingBar) {
															tpService.promptService.loadingBar.set(percent);
														}
														sdcard.data.local.curProgress.percent = tpUtil.cutUtil.truncate(percent * 100, 0);
														$scope.$apply(); // update scope immediately
														oldPercent = percent;
													}
													sdcard.data.local.curCmd.args = [localPath, file.remotePath];
												}
											}, function(error) {
												// TIP: Because save to cache directory, so no need to delete fail file.
												tpService.logService.error("downloadFile: ftp.download remote " + file.remotePath + " error=" + error);
												if (!opts.prompt.preventLoadingBar) {
													tpService.promptService.loadingBar.complete();
												}
												if (!opts.prompt.preventToast) {
													tpService.languageService.translate('SDCARD.CONTENT.DOWNLOAD_FAIL', function(string) {
														tpService.promptService.toast.error(string + file.name);
													});
												}
												if (angular.isFunction(opts.failCallback)) {
													opts.failCallback(file, error);
												}
												if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
													sdcard.data.local.curProgress.count++;
												}
												sdcard.data.local.curProgress.index++;
												asyncCallback(null, sdcard.data.local.curProgress.index - 1);
											});
										});
									})(file);
								},
								function() {
									return sdcard.data.local.curProgress.index < sdcard.data.local.curProgress.total;
								},
								function(err, n) {
									if (!opts.prompt.preventLoading) {
										tpService.promptService.loading.hide();
									}
									if (angular.isFunction(opts.doneCallback)) {
										opts.doneCallback(successFiles);
									}
									if (successFiles.length < sdcard.data.local.curProgress.total) {
										// if some fail, try reconnect
										connectFtp({
											isSilent: true,
											preventUpdateDirectory: true
										});
									}
								}
							);
						});
					}, function(error) {
						tpService.logService.error("downloadFile: getDirectory " + sdcardCacheDir + " error=" + error.code);
					});
				}, function(error) {
					tpService.logService.error("downloadFile: resolveLocalFileSystemURL " + cacheDirectory + " error=" + error.code);
				});
			}

			// Save one file or multiple checked files at current path to local system.
			//
			// Different file (type) will be saved to different local path:
			//
			// - image: saved to album via cacheDirectory (iOS); externalDataDirectory/dataDirectory** and media scan (Android)
			// - video: saved to album via cacheDirectory (iOS); externalDataDirectory/dataDirectory and media scan (Android)
			// - audio*: saved to documentsDirectory (iOS); externalDataDirectory/dataDirectory and media scan (Android)
			// - text*: saved to documentsDirectory (iOS); externalDataDirectory/dataDirectory (Android)
			// - other*: saved to documentsDirectory (iOS); externalDataDirectory/dataDirectory (Android)
			//
			// * Optional, these type's download may not be implemented now.
			// ** Many Android device has SD card (external storage), so we will try to save to it at first.
			//    If not exist, then try to save to App private path (internal storage).
			//
			// For more info about File System Layout, Refer to: https://github.com/apache/cordova-plugin-file
			//
			// NOTICE: At the best condition, we will support download all media type,
			//         but on iOS, the file type except for image and video, are stored to documentsDirectory, which is useless to user,
			//         so we will just support image and video currently.
			//
			// TODO: Make a difference between iOS and Android, for download file type.
			//       I mean we can save other file type except for image and video, to dataDirectory on Android.
			function saveFile(files, options) {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginFile() || !findCordovaPluginDevice() || !findCordovaPluginLibraryHelper()) {
					tpService.logService.warn("saveFile: plugin not ready");
					return;
				}

				if (!files || files.length <= 0) {
					tpService.logService.warn("saveFile: please select at least one valid file");
					return;
				}

				var opts = getOptions(options);

				var saveToAlbum = function(file) {
					if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
						// if it's image, save to album.
						LibraryHelper.saveImageToLibrary(function(ok) {
							tpService.logService.info("saveFile: save image " + file.localPath + " to album ok=" + ok);
							if (!opts.prompt.preventToast) {
								tpService.languageService.translate('SDCARD.CONTENT.SAVE_OK_TO_ALBUM', function(string) {
									tpService.promptService.toast.success(file.name + string);
								});
							}
						}, function(error) {
							tpService.logService.error("saveFile: save image " + file.localPath + " to album error=" + error);
							if (!opts.prompt.preventToast) {
								tpService.languageService.translate('SDCARD.CONTENT.SAVE_FAIL', function(string) {
									tpService.promptService.toast.error(string + file.name);
								});
							}
						}, file.localPath, sdcardConstant.ALBUM_NAME);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
						// if it's video, save to album.
						// FIXME: Some video format, e.g. .mov are maybe not supported by some android's media scan, so those video won't be found in album/gallery.
						//        We should prompt user this case, or prevent the user from downloading those file!
						LibraryHelper.saveVideoToLibrary(function(ok) {
							tpService.logService.info("saveFile: save video " + file.localPath + " to album ok=" + ok);
							if (!opts.prompt.preventToast) {
								tpService.languageService.translate('SDCARD.CONTENT.SAVE_OK_TO_ALBUM', function(string) {
									tpService.promptService.toast.success(file.name + string);
								});
							}
						}, function(error) {
							tpService.logService.error("saveFile: save " + file.localPath + " to album error=" + error);
							if (!opts.prompt.preventToast) {
								tpService.languageService.translate('SDCARD.CONTENT.SAVE_FAIL', function(string) {
									tpService.promptService.toast.error(string + file.name);
								});
							}
						}, file.localPath, sdcardConstant.ALBUM_NAME);
					} else {
						// don't support other types currently.
						tpService.logService.warn("saveFile: Not supported type=" + file.mediaType);
						if (!opts.prompt.preventToast) {
							tpService.promptService.toast.warning('SDCARD.CONTENT.JUST_SUPPORT_MEDIA_TYPE.SAVE');
						}
					}
				}

				// if all files have been cached, no need to show download loading
				var downloadPreventLoading = true;
				for(var i in files) {
					if (!files[i].localPath) {
						downloadPreventLoading = false;
						break;
					}
				}

				// do download
				downloadFile(files, {
					successCallback: function(file) {
						// if download ok, do save
						if (devicePlatform == "Android") {
							// if Android, copy file from cache path to data path at first.
							window.resolveLocalFileSystemURL(xDataDirectory, function(dirEntry) {
								// Create DCIM/ALBUM_NAME under one of paths below:
								//  externalRootDirectory: "/storage/emulated/0/", it's alias of "/sdcard/"
								//  externalDataDirectory: "/storage/emulated/0/Android/data/com.tplink.tpmifix/files/"
								//  dataDirectory: "/data/user/0/com.tplink.tpmifix/files/"
								// You can see externalRootDirectory is the most likely path we want.
								dirEntry.getDirectory(albumNamePart, {
									create: true,
									exclusive: false
								}, function(dirEntry) {
									var destPath = albumDir + file.name;
									tpService.logService.debug("saveFile: create DCIM file=" + destPath);
									var cachePath = sdcardUtil.pathScheme.add(file.localPath);
									window.resolveLocalFileSystemURL(cachePath, function(fileEntry) {
										fileEntry.copyTo(dirEntry, file.name, function(ok) {
											tpService.logService.info("saveFile: copy " + cachePath + " to " + destPath + " ok=" + ok);
											// save to album
											var file2;
											angular.copy(file, file2);
											file2.localPath = destPath;
											saveToAlbum(file2);
										}, function(error) {
											tpService.logService.error("saveFile: copy " + cachePath + " to " + destPath + " error=" + error.code);
										});
									}, function(error) {
										tpService.logService.error("saveFile: resolveLocalFileSystemURL " + cachePath + " error=" + error.code);
									});
								}, function(error) {
									tpService.logService.error("saveFile: getDirectory " + albumDir + " error=" + error.code);
								});
							}, function(error) {
								tpService.logService.error("saveFile: resolveLocalFileSystemURL " + xDataDirectory + " error=" + error.code);
							});
						} else if (devicePlatform == "iOS") {
							// save to album
							saveToAlbum(file);
						} else {
							tpService.logService.warn("saveFile: Not supported devicePlatform=" + devicePlatform);
						}
					},
					failCallback: function(file) {
						tpService.logService.error("saveFile: download fail, localPath=" + file.localPath);
						if (!opts.prompt.preventToast) {
							tpService.languageService.translate('SDCARD.CONTENT.SAVE_FAIL', function(string) {
								tpService.promptService.toast.error(string + file.name);
							});
						}
					},
					prompt: {
						preventLoading: downloadPreventLoading,
						preventLoadingBar: true,
						preventToast: true
					},
					isSilent: opts.isSilent
				});
			}

			function shareFile(files, options) {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginXSocialSharing()) {
					tpService.logService.warn("shareFile: plugin not ready");
					return;
				}

				if (!files || files.length <= 0) {
					tpService.logService.warn("shareFile: please select at least one valid file");
					return;
				}

				var opts = getOptions(options);

				if (!opts.prompt.preventLoading) {
					tpService.promptService.loading.show();
				}

				// if all files have been cached, no need to show download loading
				var downloadPreventLoading = true;
				for(var i in files) {
					if (!files[i].localPath) {
						downloadPreventLoading = false;
						break;
					}
				}

				// do download
				downloadFile(files, {
					successCallback: function(file) {
						tpService.logService.debug("shareFile: load file ok, localPath=" + file.localPath);
					},
					failCallback: function(file) {
						tpService.logService.debug("shareFile: load file fail, localPath=" + file.localPath);
						if (!opts.prompt.preventToast) {
							tpService.languageService.translate('SDCARD.CONTENT.DOWNLOAD_FAIL', function(string) {
								tpService.promptService.toast.error(string + file.name);
							});
						}
					},
					doneCallback: function(successFiles) {
						tpService.logService.debug("shareFile: load file end");
						// all download fail
						if (successFiles.length === 0) {
							if (!opts.prompt.preventLoading) {
								tpService.promptService.loading.hide();
							}
							if (!opts.prompt.preventToast) {
								tpService.promptService.toast.error("COMMON.CONTENT.LOAD_FAIL");
							}
							return;
						}
						// if done, do share
						var data = [];
						var shareImageToSocial = function(base64) {
							data.push(base64);
							if (data.length == successFiles.length) {
								if (!opts.prompt.preventLoading) {
									tpService.promptService.loading.hide();
								}
								plugins.socialsharing.share(null, null, data, null, function(ok) {
									tpService.logService.info("shareFile: ok=" + ok);
								}, function(error) {
									tpService.logService.error("shareFile: error=" + error);
								});
							}
						};
						var cacheBase64 = function(file, base64) {
							tpService.logService.debug("shareFile: image base64=" + base64);
							// cache base64 to file list.
							file.base64 = base64;
							// update file list
							fileListManager.updateFile(file);
							// share to social
							shareImageToSocial(file.base64);
						};
						var toDataUrl = function(file, callback, outputFormat) {
							var url = file.localPath;
							var img = new Image();
							img.crossOrigin = 'Anonymous';
							img.onload = function() {
								var canvas = document.createElement('CANVAS');
								var ctx = canvas.getContext('2d');
								var dataURL;
								canvas.height = this.height;
								canvas.width = this.width;
								ctx.drawImage(this, 0, 0);
								dataURL = canvas.toDataURL(outputFormat);
								callback(file, dataURL);
								canvas = null;
							};
							img.src = url;
						};
						for (var i in successFiles) {
							var file = successFiles[i];
							if (file.base64) {
								// found, base64 in file list
								shareImageToSocial(file.base64);
							} else {
								// not found, compute it.
								toDataUrl(file, cacheBase64);
							}
						}
						/*
						// As iOS sandbox design, we can't share files between App, so we don't adopt the method below.
						var urls = [];
						for (i in successFiles) {
							urls.push(sdcardUtil.pathScheme.add(successFiles[i].localPath));
						}
						plugins.socialsharing.share(null, null, urls, null, function(ok) {
							tpService.logService.info("shareFile: ok=" + ok);
						}, function(error) {
							tpService.logService.error("shareFile: error=" + error);
						});
						*/
					},
					prompt: {
						preventLoading: downloadPreventLoading,
						preventLoadingBar: true,
						preventToast: true
					},
					isSilent: opts.isSilent
				});
			}

			// Delete one file/directory or multiple checked files/directories at current path
			function deleteFile(files, options) {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginFtp()) {
					tpService.logService.warn("deleteFile: plugin not ready");
					return;
				}

				if (!files || files.length <= 0) {
					tpService.logService.warn("deleteFile: please select at least one valid file");
					return;
				}

				var opts = getOptions(options);

				sdcard.data.local.curProgress.total = files.length;
				sdcard.data.local.curProgress.count = 1;
				sdcard.data.local.curProgress.index = 0;
				sdcard.data.local.curProgress.percent = 0;
				var failFiles = [];
				var file;

				if (!opts.prompt.preventLoading) {
					tpService.promptService.loading.show("COMMON.CONTENT.DELETING");
				}
				// do action one by one
				async.doWhilst(
					function(asyncCallback) {
						file = files[sdcard.data.local.curProgress.index];
						tpService.logService.debug("deleteFile: async.doWhilst: index=" + sdcard.data.local.curProgress.index);
						// private namespace to make those asynchronous callback happy
						(function(file) {
							if (file.type == sdcardConstant.FILE_TYPE.DIR) {
								// delete one dir on ftp server
								cordova.plugin.ftp.rmdir(file.remotePath, function(ok) {
									tpService.logService.info("deleteFile: ftp.rmdir " + file.remotePath + " ok=" + ok);
									fileListManager.delete(file);
									if (angular.isFunction(opts.successCallback)) {
										opts.successCallback(file);
									}
									if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
										sdcard.data.local.curProgress.count++;
									}
									sdcard.data.local.curProgress.index++;
									asyncCallback(null, sdcard.data.local.curProgress.index - 1);
								}, function(error) {
									tpService.logService.error("deleteFile: ftp.rmdir " + file.remotePath + " error=" + error);
									if (!opts.prompt.preventToast) {
										tpService.languageService.translate('SDCARD.CONTENT.DELETE_FAIL', function(string) {
											tpService.promptService.toast.error(string + file.name);
										});
										// WARNING: note that just can be empty dir, or will fail!!!
										tpService.promptService.toast.warning('SDCARD.CONTENT.DELETE_DIRECTORY_PROMPT');
									}
									failFiles.push(file);
									if (angular.isFunction(opts.failCallback)) {
										opts.failCallback(file, error);
									}
									if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
										sdcard.data.local.curProgress.count++;
									}
									sdcard.data.local.curProgress.index++;
									asyncCallback(null, sdcard.data.local.curProgress.index - 1);
								});
							} else {
								cordova.plugin.ftp.rm(file.remotePath, function(ok) {
									tpService.logService.info("deleteFile: ftp.rm " + file.remotePath + " ok=" + ok);
									fileListManager.delete(file);
									if (angular.isFunction(opts.successCallback)) {
										opts.successCallback(file);
									}
									if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
										sdcard.data.local.curProgress.count++;
									}
									sdcard.data.local.curProgress.index++;
									asyncCallback(null, sdcard.data.local.curProgress.index - 1);
								}, function(error) {
									tpService.logService.error("deleteFile: ftp.rm " + file.remotePath + " error=" + error);
									if (!opts.prompt.preventToast) {
										tpService.languageService.translate('SDCARD.CONTENT.DELETE_FAIL', function(string) {
											tpService.promptService.toast.error(string + file.name);
										});
									}
									failFiles.push(file);
									if (angular.isFunction(opts.failCallback)) {
										opts.failCallback(file, error);
									}
									if (sdcard.data.local.curProgress.count < sdcard.data.local.curProgress.total) {
										sdcard.data.local.curProgress.count++;
									}
									sdcard.data.local.curProgress.index++;
									asyncCallback(null, sdcard.data.local.curProgress.index - 1);
								});
							}
						})(file);
					},
					function() {
						return sdcard.data.local.curProgress.index < sdcard.data.local.curProgress.total;
					},
					function(err, n) {
						if (!opts.prompt.preventLoading) {
							tpService.promptService.loading.hide();
						}
						if (angular.isFunction(opts.doneCallback)) {
							opts.doneCallback(failFiles);
						}
						if (!opts.preventUpdateDirectory) {
							if (failFiles.length > 0) {
								// if some fail, try reconnect
								connectFtp({
									isSilent: true,
									preventUpdateDirectory: true
								});
							} else {
								// No need, because fileListManager.delete has refresh the file list.
								// Besides, do listDirectory will lose some localFile's fields, which is not we want sometime.
								//listDirectory();
							}
						}
					}
				);
			}

			// Cancel the latest ftp action. e.g. upload, download.
			function cancel() {
				if (sdcard.data.local.connectStatus !== sdcardConstant.CONNECT_STATUS.CONNECTED || !findCordovaPluginFtp()) {
					tpService.logService.warn("cancel: plugin not ready");
					return;
				}

				tpService.promptService.loading.hide();
				tpService.promptService.loadingBar.complete();

				var curCmd = sdcard.data.local.curCmd;
				cordova.plugin.ftp.cancel(function(ok) {
					tpService.logService.info("cancel: ftp.cancel ok=" + ok);
					if (curCmd && curCmd.cmd == sdcard.action.upload) {
						var remoteFile = curCmd.args[1];
						// delete one file on ftp server
						cordova.plugin.ftp.rm(remoteFile, function(ok) {
							tpService.logService.info("cancel: rm remote " + remoteFile + " ok=" + ok);
							// if user upload one existed file to ftp server, we must refresh list to see the upload and rm result.
							listDirectory({
								isSilent: true
							});
						}, function(error) {
							tpService.logService.error("cancel: rm remote " + remoteFile + " error=" + error);
							// if user upload one existed file to ftp server, we must refresh list to see the upload and rm result.
							connectFtp({
								isSilent: true
							});
						});
					} else if (curCmd && curCmd.cmd == sdcard.action.download) {
						var localPath = curCmd.args[0];
						var filePath = sdcardUtil.pathScheme.add(localPath);
						// delete one file on local system
						window.resolveLocalFileSystemURL(filePath, function(fileEntry) {
							fileEntry.remove(function(ok) {
								tpService.logService.info("cancel: remove local filePath " + filePath + " ok=" + ok);
							}, function(error) {
								tpService.logService.error("cancel: remove local filePath " + filePath + " error=" + error.code);
							});
						}, function(error) {
							tpService.logService.error("cancel: resolveLocalFileSystemURL local filePath " + filePath + " error=" + error.code);
						});
						// FIXME: On Android, after cancel download task, next cmd will fail, and we must reconnect to ftp server.
						//        Refer to connectFtp() for more info.
						connectFtp({
							isSilent: true,
							preventUpdateDirectory: true
						});
					}
				}, function(error) {
					tpService.logService.error("cancel: ftp.cancel error=" + error);
					// if fail, try reconnect
					connectFtp({
						isSilent: true,
						preventUpdateDirectory: true
					});
				});
			}
		}
	])

	/**
	 * @description
	 * The directive to process multiple select checkbox.
	 *
	 * @memberof tpmifix.mod.sdcard
	 * @ngdoc directive
	 * @name sdcardCheckbox
	 */
	.directive('sdcardCheckbox', [

		function() {
			var jqLite = angular.element;
			return {
				transclude: true,
				restrict: 'E',
				scope: {
					show: '=?',
					checked: '=?',
					allChecked: '=?'
				},
				link: function(scope, element, attrs) {
					function clickCallback(event) {
						if (jqLite(event.target)[0].localName == 'input') {
							return; /*let checkbox click callback first*/
						}
						scope.checked = element.find('input')[0].checked = !element.find('input')[0].checked;
						scope.$apply();
						event.stopPropagation();
					}
					scope.$watch('show', function(newValue, oldValue) {
						if (newValue === true) {
							element.parent()[0].addEventListener('click', clickCallback, true);
						} else if (newValue === false) {
							element.parent()[0].removeEventListener('click', clickCallback, true);
						}
					}, true);
				},
				template: '<label class="checkbox sdcard-checkbox" ng-class="{false:\'invisible\'}[show]"><input type="checkbox" ng-model="checked"></label><div ng-transclude ng-class="{true:\'sdcard-checkbox-show\'}[show]"></div>'
			};
		}
	])

	/**
	 * @description
	 * The util to manage local and ftp path.
	 *
	 * @memberof tpmifix.mod.sdcard
	 * @ngdoc service
	 * @name sdcardUtil
	 * @requires sdcardValue
	 * @requires tpService
	 * @requires tpUtil
	 * @requires $ionicScrollDelegate
	 */
	.factory('sdcardUtil', ['sdcardConstant', 'sdcardValue', 'tpService', 'tpUtil', '$ionicScrollDelegate',
		function(sdcardConstant, sdcardValue, tpService, tpUtil, $ionicScrollDelegate) {
			/**
			 * @description
			 * FtpPathManager class.
			 *
			 * Create one instance to use it.
			 *
			 * NOTE: Use Array push() and pop() to simulate the traverse over ftp path, because user can just go in and out between parent and child directory.
			 *   Every path node has these fields:
			 *   1. name in `nameList`: current path/directory name (as `string`).
			 *   2. file list in `fileList`: current file list under this path/directory (as `array`).
			 *   3. scroll postion object in `scrollPosition`: current list scroll postion (as `object` which has two fields `left` and `top`).
			 *
			 * TIP: User can click *nav back button* once to back to parent dir, maybe we can add **long touch** event on *nav back button* to back to home path immediately,
			 *   and say to user "Wa, you get one new skill!".
			 *
			 * @memberof sdcardUtil
			 */
			function FtpPathManager(rootPath) {
				this.rootPath = rootPath;
				this.curPath = {
					// NOTE: filelist is always shorter than nameList, refer to goChildPath() and goParentPath().
					nameList: [rootPath],
					fileList: [
						[]
					],
					scrollPosition: []
				};
			}

			/**
			 * @description
			 * Get the full path of the file `filename`.
			 *
			 * @memberof FtpPathManager
			 * @param {string} filename The file name.
			 * @returns {string}
			 */
			FtpPathManager.prototype.getFullPath = function(filename) {
				return this.curPath.nameList.join("/") + "/" + filename;
			};

			/**
			 * @description
			 * Get the current path.
			 *
			 * @memberof FtpPathManager
			 * @returns {string}
			 */
			FtpPathManager.prototype.getCurPath = function() {
				return this.curPath.nameList.join("/");
			};

			/**
			 * @description
			 * Get the current path's name part.
			 *
			 * @memberof FtpPathManager
			 * @returns {string}
			 */
			FtpPathManager.prototype.getCurPathName = function() {
				return this.curPath.nameList[this.curPath.nameList.length - 1];
			};

			/**
			 * @description
			 * Is at ftp home path currently.
			 *
			 * @memberof FtpPathManager
			 * @returns {boolean}
			 */
			FtpPathManager.prototype.isAtFtpHomePath = function() {
				if (this.rootPath == this.getCurPath()) {
					return true;
				} else {
					return false;
				}
			};

			/**
			 * @description
			 * Go to child path `pathname`.
			 *
			 * @memberof FtpPathManager
			 * @param {string} pathname The path name.
			 * @param {object} fileList The file list of current path **before** go to child path.
			 * @param {function} successCallback Success callback.
			 * @returns {string} The new path.
			 */
			FtpPathManager.prototype.goChildPath = function(pathname, fileList, successCallback) {
				this.curPath.nameList.push(pathname);
				this.curPath.fileList.push(fileList);
				this.curPath.scrollPosition.push($ionicScrollDelegate.getScrollPosition());
				// scroll to list top
				$ionicScrollDelegate.scrollTop();
				var newPath = this.getCurPath();
				// always success
				if (angular.isFunction(successCallback)) {
					successCallback(newPath);
				}
				return newPath;
			};

			/**
			 * @description
			 * Go to parent path.
			 *
			 * @memberof FtpPathManager
			 * @param {function} successCallback Success callback.
			 * @returns {string} The new path.
			 */
			FtpPathManager.prototype.goParentPath = function(successCallback) {
				this.curPath.nameList.pop();
				var newPath = this.getCurPath() || this.rootPath;
				var fileList = this.curPath.fileList.pop();
				var scrollPosition = this.curPath.scrollPosition.pop();
				// scroll to origin postion before go into child path
				$ionicScrollDelegate.scrollTo(scrollPosition.left, scrollPosition.top);
				// always success
				if (angular.isFunction(successCallback)) {
					successCallback(newPath, fileList, scrollPosition);
				}
				return newPath;
			};

			/**
			 * @description
			 * Create one ftpPathManager instance/object to manage ftp path.
			 * Refer to its class `prototype` for more info about available methods.
			 *
			 * @memberof sdcardUtil
			 * @returns {object} The new FtpPathManager object.
			 */
			var newFtpPathManager = function() {
				return new FtpPathManager(sdcardValue.FTP_HOME_PATH);
			}

			/**
			 * @description
			 * FileListManager class.
			 *
			 * Create one instance to use it.
			 *
			 * @memberof sdcardUtil
			 */
			function FileListManager() {
				this.list = {
					image: [],
					video: [],
					audio: [],
					text: [],
					application: [],
					other: [],
					dir: [],
					file: [],
					all: []
				}
			}

			/**
			 * @description
			 * Clear list.
			 *
			 * @memberof FileListManager
			 */
			FileListManager.prototype.clear = function() {
				this.list = {
					image: [],
					video: [],
					audio: [],
					text: [],
					application: [],
					other: [],
					dir: [],
					file: [],
					all: []
				}
			};

			/**
			 * @description
			 * Get list.
			 *
			 * @memberof FileListManager
			 * @returns {object}
			 */
			FileListManager.prototype.getList = function() {
				return this.list;
			};

			/**
			 * @description
			 * Get list.
			 *
			 * @memberof FileListManager
			 * @param {object} list
			 */
			FileListManager.prototype.setList = function(list) {
				this.list = list;
			};

			/**
			 * @description
			 * Find one file (by its `digest`) in list `all`.
			 * If file does not have `digest`, or not found, will return `-1`.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} file
			 * @returns {number} index
			 */
			FileListManager.prototype.find = function(file) {
				for (var i in this.list.all) {
					if (this.list.all[i].digest == file.digest) {
						return i;
					}
				}
				return -1;
			};

			/**
			 * @description
			 * Get list `all` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getAll = function(index) {
				if (index >= 0 && index < this.list.all.length) {
					return this.list.all[index];
				} else {
					return this.list.all;
				}
			};

			/**
			 * @description
			 * Get list `dir` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getDir = function(index) {
				if (index >= 0 && index < this.list.dir.length) {
					return this.list.dir[index];
				} else {
					return this.list.dir;
				}
			};

			/**
			 * @description
			 * Get list `file` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getFile = function(index) {
				if (index >= 0 && index < this.list.file.length) {
					return this.list.file[index];
				} else {
					return this.list.file;
				}
			};

			/**
			 * @description
			 * Get list `image` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getImage = function(index) {
				if (index >= 0 && index < this.list.image.length) {
					return this.list.image[index];
				} else {
					return this.list.image;
				}
			};

			/**
			 * @description
			 * Get list `video` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getVideo = function(index) {
				if (index >= 0 && index < this.list.video.length) {
					return this.list.video[index];
				} else {
					return this.list.video;
				}
			};

			/**
			 * @description
			 * Get list `audio` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getAudio = function(index) {
				if (index >= 0 && index < this.list.audio.length) {
					return this.list.audio[index];
				} else {
					return this.list.audio;
				}
			};

			/**
			 * @description
			 * Get list `text` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getText = function(index) {
				if (index >= 0 && index < this.list.text.length) {
					return this.list.text[index];
				} else {
					return this.list.text;
				}
			};

			/**
			 * @description
			 * Get list `application` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getApplication = function(index) {
				if (index >= 0 && index < this.list.application.length) {
					return this.list.application[index];
				} else {
					return this.list.application;
				}
			};

			/**
			 * @description
			 * Get list `other` or one item in `index` of it.
			 *
			 * @memberof FileListManager
			 * @param {number|undefined} index
			 * @returns {array|object}
			 */
			FileListManager.prototype.getOther = function(index) {
				if (index >= 0 && index < this.list.other.length) {
					return this.list.other[index];
				} else {
					return this.list.other;
				}
			};

			/**
			 * @description
			 * Get file's index in list.
			 *
			 * @memberof FileListManager
			 * @param {object} file
			 * @returns {object} The object contains index of every types.
			 */
			FileListManager.prototype.getIndex = function(file) {
				return {
					all: this.list.all.indexOf(file),
					file: this.list.file.indexOf(file),
					dir: this.list.dir.indexOf(file),
					image: this.list.image.indexOf(file),
					video: this.list.video.indexOf(file),
					audio: this.list.audio.indexOf(file),
					text: this.list.text.indexOf(file),
					application: this.list.application.indexOf(file),
					other: this.list.other.indexOf(file)
				}
			};

			/**
			 * @description
			 * Add file to list.
			 *
			 * @memberof FileListManager
			 * @param {object} file
			 */
			FileListManager.prototype.add = function(file) {
				this.list.all.push(file);
				if (file.type == sdcardConstant.FILE_TYPE.FILE) {
					this.list.file.push(file);
					if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
						this.list.image.push(file);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
						this.list.video.push(file);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.AUDIO) {
						this.list.audio.push(file);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.TEXT) {
						this.list.text.push(file);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
						this.list.application.push(file);
					} else {
						this.list.other.push(file);
					}
				} else if (file.type == sdcardConstant.FILE_TYPE.DIR) {
					this.list.dir.push(file);
				} else {
					this.list.file.push(file);
				}
			};

			/**
			 * @description
			 * Delete file from list.
			 *
			 * @memberof FileListManager
			 * @param {object} file
			 */
			FileListManager.prototype.delete = function(file) {
				this.list.all.splice(this.list.all.indexOf(file), 1);
				if (file.type == sdcardConstant.FILE_TYPE.FILE) {
					this.list.file.splice(this.list.file.indexOf(file), 1);
					if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
						this.list.image.splice(this.list.image.indexOf(file), 1);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
						this.list.video.splice(this.list.video.indexOf(file), 1);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.AUDIO) {
						this.list.audio.splice(this.list.audio.indexOf(file), 1);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.TEXT) {
						this.list.text.splice(this.list.text.indexOf(file), 1);
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
						this.list.application.splice(this.list.application.indexOf(file), 1);
					} else {
						this.list.other.splice(this.list.other.indexOf(file), 1);
					}
				} else if (file.type == sdcardConstant.FILE_TYPE.DIR) {
					this.list.dir.splice(this.list.dir.indexOf(file), 1);
				} else {
					this.list.file.splice(this.list.file.indexOf(file), 1);
				}
			};

			/**
			 * @description
			 * Replace one file in list with newFile.
			 *
			 * @memberof FileListManager
			 * @param {object} file
			 * @param {object} newFile
			 */
			FileListManager.prototype.replace = function(file, newFile) {
				if (!file || !newFile || file.type != newFile.type || file.mediaType != newFile.mediaType) {
					return;
				}
				var index = this.getIndex(file);
				this.list.all[index.all] = newFile;
				if (file.type == sdcardConstant.FILE_TYPE.FILE) {
					this.list.file[index.file] = newFile;
					if (file.mediaType == sdcardConstant.MEDIA_TYPE.IMAGE) {
						this.list.image[index.image] = newFile;
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.VIDEO) {
						this.list.video[index.video] = newFile;
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.AUDIO) {
						this.list.audio[index.audio] = newFile;
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.TEXT) {
						this.list.text[index.text] = newFile;
					} else if (file.mediaType == sdcardConstant.MEDIA_TYPE.APPLICATION) {
						this.list.application[index.application] = newFile;
					} else {
						this.list.other[index.other] = newFile;
					}
				} else if (file.type == sdcardConstant.FILE_TYPE.DIR) {
					this.list.dir[index.dir] = newFile;
				} else {
					this.list.file[index.file] = newFile;
				}
			};

			/**
			 * @description
			 * Update one file in list.
			 *
			 * @memberof FileListManager
			 * @param {object} file
			 */
			FileListManager.prototype.updateFile = function(file) {
				this.replace(this.getAll(this.find(file)), file);
			};

			/**
			 * @description
			 * Sort list.
			 *
			 * @memberof FileListManager
			 * @param {string} key Sort by this key. Default is "name".
			 */
			FileListManager.prototype.sort = function(key) {
				if (!key) {
					key = "name";
				}
				this.list.image = tpUtil.sortUtil.sortObjArray(this.list.image, key);
				this.list.video = tpUtil.sortUtil.sortObjArray(this.list.video, key);
				this.list.audio = tpUtil.sortUtil.sortObjArray(this.list.audio, key);
				this.list.text = tpUtil.sortUtil.sortObjArray(this.list.text, key);
				this.list.application = tpUtil.sortUtil.sortObjArray(this.list.application, key);
				this.list.other = tpUtil.sortUtil.sortObjArray(this.list.other, key);
				this.list.dir = tpUtil.sortUtil.sortObjArray(this.list.dir, key);
				this.list.file = tpUtil.sortUtil.sortObjArray(this.list.file, key);
				this.list.all = this.list.dir.concat(this.list.file);
			};

			/**
			 * @description
			 * Create one FileListManager instance/object to manage file list.
			 * Refer to its class `prototype` for more info about available methods.
			 *
			 * @memberof sdcardUtil
			 * @returns {object} The new FileListManager object.
			 */
			var newFileListManager = function() {
				return new FileListManager();
			}

			/**
			 * @description
			 * Sort two array by key and concat them.
			 *
			 * @memberof sdcardUtil
			 * @deprecated
			 * @param {array} array1 The first array.
			 * @param {array} array2 The second array.
			 * @param {string} key The key.
			 * @returns {string} The new array after sorted and concated.
			 */
			function sortAndConcatList(array1, array2, key) {
				if (!key) {
					key = "name";
				}
				return tpUtil.sortUtil.sortObjArray(array1, key).concat(tpUtil.sortUtil.sortObjArray(array2, key));
			}

			/**
			 * @description
			 * Get the filename from one fullPath.
			 *
			 * @memberof sdcardUtil
			 * @param {string} fullPath The full path.
			 * @returns {string} The file name.
			 */
			function getFilename(fullPath) {
				return fullPath.split("/").pop();
			}

			/**
			 * @description
			 * Delete "file://", and return "/path/to/file".
			 *
			 * @memberof sdcardUtil
			 * @alias pathScheme.delete
			 * @param {string} fullPath The full path.
			 * @returns {string} The new path without file scheme.
			 */
			function deletePathScheme(fullPath) {
				// Delete "file://", and return "/path/to/file"
				// Tip: Can add more Scheme here, like "cdvfile://"...
				if (fullPath.toLowerCase().indexOf("file://") === 0) {
					return fullPath.substring(7);
				} else {
					return fullPath;
				}
			}

			/**
			 * @description
			 * Add "file://", and return "file:///path/to/file".
			 *
			 * @memberof sdcardUtil
			 * @alias pathScheme.add
			 * @param {string} fullPath The full path.
			 * @returns {string} The new path with file scheme.
			 */
			function addPathScheme(fullPath) {
				// Add "file://", and return "file:///path/to/file"
				if (fullPath.toLowerCase().indexOf("file://") === 0) {
					return fullPath;
				} else {
					return "file://" + fullPath;
				}
			}

			/**
			 * @description
			 * Generate the digest (based on file `name`, `curPath` and `modifiedDate`) of the file.
			 * This is the unique identification of the file at localPath.
			 *
			 * @memberof sdcardUtil
			 * @param {object} file The file object. Refer to `ftpFileTemplate`.
			 * @returns {string} The digest of the file.
			 */
			function digestFile(file) {
				return CryptoJS.MD5([file.name, file.curPath, file.modifiedDate].join('_')).toString();
			}

			/**
			 * @description
			 * Set cache file's local path to local storage.
			 *
			 * @memberof sdcardUtil
			 * @alias cacheFileManager.set
			 * @param {object} file The file object. Refer to `ftpFileTemplate`.
			 */
			function setCacheFilePath(file) {
				if (!file.digest) {
					file.digest = digestFile(file);
				}
				tpService.localDataService.setApp(sdcardConstant.FILE_CACHE_KEY + file.digest, file.localPath);
			}

			/**
			 * @description
			 * Clear cache file's local path in local storage.
			 *
			 * @memberof sdcardUtil
			 * @alias cacheFileManager.clear
			 * @param {object} file The file object. Refer to `ftpFileTemplate`.
			 * @param {string} curPath The current ftp path.
			 */
			function clearCacheFilePath(file) {
				if (!file.digest) {
					file.digest = digestFile(file);
				}
				tpService.localDataService.clearApp(sdcardConstant.FILE_CACHE_KEY + file.digest);
			}

			/**
			 * @description
			 * Get cache file's local path from local storage.
			 *
			 * @memberof sdcardUtil
			 * @alias cacheFileManager.get
			 * @param {object} file The file object. Refer to `ftpFileTemplate`.
			 * @param {function} successCallback The callback function, invoked with arg `{object} file`.
			 * @param {function} failCallback The callback function, invoked with arg `{object} file`.
			 */
			function getCacheFilePath(file, successCallback, failCallback) {
				if (!file.digest) {
					file.digest = digestFile(file);
				}
				var cacheFilePath = tpService.localDataService.getApp(sdcardConstant.FILE_CACHE_KEY + file.digest);
				var failHandler = function(file) {
					clearCacheFilePath(file);
					if (angular.isFunction(failCallback)) {
						failCallback(file);
					}
				}
				if (cacheFilePath) {
					window.resolveLocalFileSystemURL(addPathScheme(cacheFilePath), function(fileEntry) {
						fileEntry.file(function(fileObj) {
							if (fileObj.size == file.size) {
								// only if size is also equal, we think it's the cache file we want.
								file.localPath = cacheFilePath;
								if (angular.isFunction(successCallback)) {
									successCallback(file);
								}
							} else {
								failHandler(file);
							}
						}, function() {
							failHandler(file);
						});
					}, function(error) {
						// find it in local storage but not exist in local path, clear the record.
						failHandler(file);
					});
				} else {
					if (angular.isFunction(failCallback)) {
						failCallback(file);
					}
				}
			}

			return {
				newFtpPathManager: newFtpPathManager,
				newFileListManager: newFileListManager,
				sortAndConcatList: sortAndConcatList,
				getFilename: getFilename,
				pathScheme: {
					add: addPathScheme,
					delete: deletePathScheme
				},
				digestFile: digestFile,
				cacheFileManager: {
					get: getCacheFilePath,
					set: setCacheFilePath,
					clear: clearCacheFilePath
				}
			}
		}
	])

	/**
	 * @description
	 * The util to detect file's media type.
	 *
	 * @memberof tpmifix.mod.sdcard
	 * @ngdoc service
	 * @name detectMediaTypeUtil
	 * @requires sdcardConstant
	 */
	.factory('detectMediaTypeUtil', ['sdcardConstant',
		function(sdcardConstant) {
			// All supported media type
			var mediaTypeKeyList = {
				image: sdcardConstant.MEDIA_TYPE.IMAGE,
				video: sdcardConstant.MEDIA_TYPE.VIDEO,
				audio: sdcardConstant.MEDIA_TYPE.AUDIO,
				text: sdcardConstant.MEDIA_TYPE.TEXT,
				application: sdcardConstant.MEDIA_TYPE.APPLICATION,
				other: sdcardConstant.MEDIA_TYPE.OTHER
			};
			var mediaTypeList = {
				image: ["bmp", "gif", "jpeg", "jpg", "jpf", "png", "tif", "tiff"],
				video: ["mov", "mp4", "mpeg4"],
				audio: ["flac", "mp3", "mod", "mid", "ogg", "wma"],
				text: ["config", "css", "csv", "htm", "html", "markdown", "md", "js", "json", "rtf", "txt", "xml"],
				application: ["pdf"],
				other: []
			};
			var POSTFIX_POINT = ".";

			/**
			 * @description
			 * List all supported media type.
			 *
			 * @memberof detectMediaTypeUtil
			 * @alias listSupportedMediaType
			 * @returns {string} The supported media type list and its key list.
			 */
			var getSupportedMediaTypeList = function() {
				return {
					mediaTypeList: mediaTypeList,
					mediaTypeKeyList: mediaTypeKeyList
				};
			}

			/**
			 * @description
			 * Parse and split the file's name and postfix.
			 *
			 * @memberof detectMediaTypeUtil
			 * @private
			 * @alias detectNameAndPostfix
			 * @param {string} filename The file name.
			 * @returns {string} The object represent file's name and postfix, e.g. `{name:"abc", postfix:"txt"}`. Refer to supported postfix in `mediaTypeList`.
			 */
			var parseNameAndPostfix = function(filename) {
				var name = "";
				var postfix = "";
				var loc = filename.lastIndexOf(POSTFIX_POINT);
				if (loc > 0) {
					name = filename.substring(0, loc);
					postfix = filename.substring(loc + 1).toLowerCase();
				} else { // not found or like ".png" (if no name, like ".png" will judged as name, and this file will be judged as media type `other`)
					name = filename;
				}
				return {
					name: name,
					postfix: postfix
				}
			}

			/**
			 * @description
			 * If it is a regular file, you can detect file's media type (according to file name's postfix).
			 *
			 * @memberof detectMediaTypeUtil
			 * @param {string} postfix The file name postfix.
			 * @returns {string} The string represent file's media type. Refer to `mediaTypeKeyList`.
			 */
			var detectMediaTypeFromPostfix = function(postfix) {
				var postfix2 = postfix.toLowerCase();
				if (postfix2) {
					if (mediaTypeList.image.indexOf(postfix2) > -1) {
						return mediaTypeKeyList.image;
					} else if (mediaTypeList.video.indexOf(postfix2) > -1) {
						return mediaTypeKeyList.video;
					} else if (mediaTypeList.audio.indexOf(postfix2) > -1) {
						return mediaTypeKeyList.audio;
					} else if (mediaTypeList.text.indexOf(postfix2) > -1) {
						return mediaTypeKeyList.text;
					} else if (mediaTypeList.application.indexOf(postfix2) > -1) {
						return mediaTypeKeyList.application;
					} else {
						return mediaTypeKeyList.other;
					}
				} else {
					return mediaTypeKeyList.other;
				}
			}

			/**
			 * @description
			 * If it is a regular file, you can detect file's media type.
			 *
			 * @memberof detectMediaTypeUtil
			 * @param {string} filename The file name.
			 * @returns {string} The string represent file's media type. Refer to `mediaTypeKeyList`.
			 */
			var detectMediaType = function(filename) {
				var postfix = parseNameAndPostfix(filename).postfix;
				return detectMediaTypeFromPostfix(postfix);
			}

			return {
				listSupportedMediaType: getSupportedMediaTypeList,
				detectNameAndPostfix: parseNameAndPostfix,
				detectMediaTypeFromPostfix: detectMediaTypeFromPostfix,
				detectMediaType: detectMediaType
			}
		}
	])

})();
