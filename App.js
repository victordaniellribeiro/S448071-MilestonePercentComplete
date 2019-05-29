Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',

	_initDate: undefined,
    _endDate: undefined,
    _milestoneComboStore: undefined,
    _milestoneComboBox: undefined,

	items:[
        {
            xtype:'container',
            itemId:'header',
            cls:'header'
        },
        {
            xtype:'container',
            itemId:'bodyContainer',
            layout: {
		        type: 'hbox'
		    },
            width:'100%',
            autoScroll:true
        }
    ],



	launch: function() {
		//Write app code here

		//API Docs: https://help.rallydev.com/apps/2.1/doc/

		var context = this.getContext();
		var project = context.getProject()['ObjectID'];

		console.log('project:', project);

		var mainPanel = Ext.create('Ext.panel.Panel', {
			title: 'Percent complete report',
			layout: {
				type: 'vbox',
				align: 'stretch',
				padding: 5
			},
			//height: 800,
			padding: 5,
			itemId: 'mainPanel',
		});
		this.myMask = new Ext.LoadMask({
			msg: 'Please wait...',
			target: mainPanel
		});


		this._milestoneComboBox = Ext.create('Rally.ui.combobox.MilestoneComboBox', {
			itemId: 'milestoneComboBox',
			fieldLabel: 'Choose Milestone',
			allowClear: true,
			multiSelect: true,
			queryMode: 'local',
			width: 300,
			scope: this,
			listeners: {
				afterrender: function(combobox) {
					combobox.disable();
				},
				ready: function(combobox) {
					console.log('ready: ', combobox);
					combobox.refreshStore();
					combobox.enable();
				},
				select: function(combobox, records) {
					console.log('comobo size:', records.length);

					var reportStore = Ext.create('Ext.data.JsonStore', {
						fields: ['milestonename', 
								'percentComplete', 
								'storiesLeft', 
								'totalPlanEstimate', 
								'blocked', 
								'totalPlanBlocked', 
								'storiesCompleted', 
								'totalPlanEstimateCompleted',
								'defectsOpen', 
								'totalPlanEstimateDefectsOpen',
								'targetDate']
					});					

					this.myMask.show();
					var promises = [];


					for (var j = 0; j < records.length ; j++) {

						var deferred = Ext.create('Deft.Deferred');

						var i = j;
						var milestoneId = records[i].get('ObjectID');
						var milestoneName = records[i].get('Name');
						var targetDate = records[i].get('TargetDate');
						var milestoneFormattedId = records[i].get('FormattedID');

						console.log('Calling milestone: ', milestoneName, milestoneFormattedId);
						this._createDataCall(project, milestoneName, milestoneId, targetDate, deferred, this);

						promises.push(
							deferred
						);
					}

					Deft.Promise.all(promises).then( {
						success: function(records) {
							console.log('before assembling grid: ', records);
							reportStore.add(records);

							console.log('creating grid');
							//console.log('report store:', reportStore);

							var grid = Ext.create('Ext.grid.Panel', {
							height: 350,
							//[ '', '', '', '', '', '']
							columns: [{
								text: 'Milestone Name',
								flex: 1,
								sortable: true,
								dataIndex: 'milestonename'
							}, {
								text: 'Percent Complete',
								width: 120,
								sortable: true,
								dataIndex: 'percentComplete'
							}, {
								text: '# Stories Left',
								width: 100,
								sortable: true,
								dataIndex: 'storiesLeft'
							}, {
								text: 'Total Plan Estimate',
								width: 120,
								sortable: true,
								dataIndex: 'totalPlanEstimate'
							}, {
								text: '# Blocked',
								width: 75,
								sortable: true,
								dataIndex: 'blocked'
							}, {
								text: 'Total Plan Blocked',
								width: 120,
								sortable: true,
								dataIndex: 'totalPlanBlocked'
							}, {
								text: '# Stories ready to accept',
								width: 150,
								sortable: true,
								dataIndex: 'storiesCompleted'
							}, {
								text: 'Total plan estimate to accept',
								width: 150,
								sortable: true,
								dataIndex: 'totalPlanEstimateCompleted'
							}, {
								text: '# Open Defects',
								width: 110,
								sortable: true,
								dataIndex: 'defectsOpen'
							}, {
								text: 'Total plan estimate of Open Defects',
								width: 190,
								sortable: true,
								dataIndex: 'totalPlanEstimateDefectsOpen'
							}, {
								text: 'Target date',
								xtype: 'datecolumn',
								width: 75,
								sortable: true,
								format   : 'm/d/Y',
								dataIndex: 'targetDate'
							}],
							flex: 1,
							//title: 'Release: ' + releaseName,
							store: reportStore
							});

							this.down('#mainPanel').removeAll(true);
							this.down('#mainPanel').add(grid);

							this.myMask.hide();
						},
						scope:this
					});
				},
				scope: this
			}
		});

		this._milestoneComboStore = this._milestoneComboBox.getStore();

		this.down('#header').add([
		{
			xtype: 'panel',
			autoWidth: true,
			//height: 120,
			layout: 'hbox',

			items: [{
				xtype: 'panel',
				title: 'Choose date range for milestone:',
				//width: 450,
				//layout: 'fit',
				flex: 3,
				align: 'stretch',
				autoHeight: true,
				bodyPadding: 10,
				items: [{
					xtype: 'datefield',
					anchor: '100%',
			        fieldLabel: 'From',
					scope: this,
		        	listeners : {
		        		change: function(picker, newDate, oldDate) {
		        			this._initDate = newDate;
		        			var that = this;

		        			//console.log('Store:', this._milestoneComboStore);
		        			this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, that);
		        		},
		        		scope:this
		        	}
				}, {
					xtype: 'datefield',
					anchor: '100%',
			        fieldLabel: 'To',
					scope: this,
		        	listeners : {
		        		change: function(picker, newDate, oldDate) {
		        			this._endDate = newDate;
		        			var that = this;

		        			//console.log('Store:', this._milestoneComboStore);
		        			this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, that);
		        		},
		        		scope:this
		        	}
				},
				{					
			        xtype: 'rallyfieldvaluecombobox',
			        fieldLabel: 'Milestone Types',
			        model: 'Milestone',
			        field: 'c_Type',
			        scope: this,
			        listeners: {
			        	change: function(combo) {
							console.log('Milestone type: ', combo.getValue());
							//console.log('store', this._milestoneComboStore);

							this._milestoneType = combo.getValue();

							this._applyMilestoneRangeFilter(this._initDate, this._endDate, this._milestoneComboStore, this, this._milestoneType);
						},
						scope: this
			        }
				},
				{
					xtype: 'fieldcontainer',
					fieldLabel: 'Milestone',
					pack: 'end',
					labelAlign: 'left',
					items: [
						this._milestoneComboBox
					]
				}]
			}]
		}]);

		this.add(mainPanel);
		this._milestoneComboBox.select('');
	},


	_applyMilestoneRangeFilter: function(initDate, endDate, store, scope, milestoneType) {
		//console.log(initDate, endDate, store, scope);
		if (initDate && !endDate && !milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() > initDate.getTime()) {
						return record;
					}
				}
			}, scope);

		} else if (endDate && !initDate && !milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < endDate.getTime()) {
						return record;
					}
				}
			}, scope);
		} else if (initDate && endDate && !milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if ((record.get('TargetDate').getTime() > initDate.getTime()) && 
						(record.get('TargetDate').getTime() < endDate.getTime())) {
						return record;
					}
				}
			}, scope);
		} else if (initDate && !endDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() > initDate.getTime() &&
						(record.get('c_Type') === this._milestoneType)) {
						return record;
					}
				}
			}, scope);
		} else if (!initDate && endDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < initDate.getTime() &&
						(record.get('c_Type') === this._milestoneType)) {
						return record;
					}
				}
			}, scope);
		} else if (!initDate && !endDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('c_Type') && (record.get('c_Type') === this._milestoneType) ) {
					return record;
				}
			}, scope);
		} else if (endDate && initDate && milestoneType) {
			this._milestoneComboStore.filterBy(function(record) {
				if (record.get('TargetDate')) {
					if (record.get('TargetDate').getTime() < endDate.getTime() &&
						(record.get('TargetDate').getTime() > initDate.getTime()) &&
						(record.get('c_Type') === this._milestoneType)) {
						return record;
					}
				}
			}, scope);
		} else {
			this._milestoneComboStore.filterBy(function(record) {				
				return record;
			});
		}
	},


	_createDataCall: function(projectId, milestoneName, milestoneId, targetDate, deferred, that) {
		function DataCall() {
			this.milestoneName = milestoneName;
			this.milestoneId = milestoneId;
			this.projectId = projectId;
			this.deferred = deferred;
			this.that = that;

			this.execute = function() {
				console.log('executing call:', milestoneName, milestoneId, targetDate);

				this._loadStories(projectId, milestoneId).then({
					success: function() {
						return this._loadDefects(milestoneId);
					}, scope: this
				}).then({
					success: function() {
						return this._loadTestSets(milestoneId);
					}, scope: this
				}).then({
					success: function() {
						//console.log('report loaded:', this.stories, this.defects, this.testSets);
						return deferred.resolve(that._getStoreData(milestoneName, targetDate, this.stories, this.defects, this.testSets));
					}, scope: this
				});
			},


			this._loadStories = function(projectId, milestoneId) {
				console.log('loading stories:', milestoneId);
				var deferred = Ext.create('Deft.Deferred');

				var storiesStore = Ext.create('Rally.data.WsapiDataStore', {
					model: 'HierarchicalRequirement',
					context: {
				        projectScopeUp: false,
				        projectScopeDown: true,
				        project: null //null to search all workspace
				    },
					fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'Blocked'],
					filters: [{
						property: 'PortfolioItem.Milestones',
						operator: 'contains',
						value: "/milestone/" + milestoneId
					}],
					limit: Infinity
				});

				storiesStore.load().then({
					success: function(records) {
						this.stories = records;
						//console.log('Stories:', records);
						deferred.resolve(records);

					},
					scope: this
				});

				return deferred.promise;
			},


			this._loadDefects = function(milestoneId) {
				console.log('loading defects:', milestoneId);
				var deferred = Ext.create('Deft.Deferred');
				var defectsStore = Ext.create('Rally.data.WsapiDataStore', {
					model: 'Defect',
					context: {
				        projectScopeUp: false,
				        projectScopeDown: true,
				        project: null //null to search all workspace
				    },
					fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'Blocked'],
					filters: [{
						property: 'Milestones',
						operator: 'contains',
						value: "/milestone/" + milestoneId
					}],
					limit: Infinity
				});

				defectsStore.load().then({
					success: function(records) {
						this.defects = records;
						//console.log('Defects:', records);
						deferred.resolve(records);

					},
					scope: this
				});
				return deferred.promise;
			},


			this._loadTestSets = function(milestoneId) {
				console.log('loading testSets:', milestoneId);
				var deferred = Ext.create('Deft.Deferred');
				var testStore = Ext.create('Rally.data.WsapiDataStore', {
					model: 'TestSet',
					context: {
				        projectScopeUp: false,
				        projectScopeDown: true,
				        project: null //null to search all workspace
				    },
					fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'Blocked'],
					filters: [{
						property: 'Milestones',
						operator: 'contains',
						value: "/milestone/" + milestoneId
					}],
					limit: Infinity
				});

				testStore.load().then({
					success: function(records) {
						this.testSets = records;
						//console.log('testStore:', records);
						deferred.resolve(records);

					},
					scope: this
				});
				return deferred.promise;
			};
		}

		var data = new DataCall(milestoneName, milestoneId, deferred, that);
		data.execute();
	},


	_getStoreData: function(milestoneName, targetDate, stories, defects, testSets) {
		//console.log('Milestone Name:', milestoneName);
		//console.log('Local stories:', stories);
		//console.log('Local defects:', defects);
		//console.log('Local testSets:', testSets);

		var percentComplete = this._calculatePercentComplete(stories, defects, testSets);
		var storiesLeft = this._calculateStoriesLeft(stories, defects, testSets);
		var totalPlanEstimate = this._calculateTotalPlanEstimate(stories, defects, testSets);
		var storiesBlocked = this._calculateStoriesBlocked(stories, defects, testSets);
		var totalPlanEstimateBlocked = this._calculateTotalPlanEstimateBlocked(stories, defects, testSets);
		var storiesCompleted = this._calculateStoriesCompleted(stories, defects, testSets);
		var totalPlanEstimateCompleted = this._calculateTotalPlanEstimateCompleted(stories, defects, testSets);
		var defectsOpen = this._calculateDefectsOpen(defects);
		var totalPlanEstimateDefectsOpen = this._calculateTotalPlanEstimateDefectsOpen(defects);

		var row = {
			milestonename: milestoneName,
			percentComplete: percentComplete,
			storiesLeft: storiesLeft,
			totalPlanEstimate: totalPlanEstimate,
			blocked: storiesBlocked,
			totalPlanBlocked: totalPlanEstimateBlocked,
			storiesCompleted: storiesCompleted,
			totalPlanEstimateCompleted: totalPlanEstimateCompleted,
			defectsOpen: defectsOpen,
			totalPlanEstimateDefectsOpen: totalPlanEstimateDefectsOpen,
			targetDate: targetDate
		};

		console.log('milestone row:', row);

		return row;
	},


	_calculatePercentComplete: function(stories, defects, testSets) {
		var totalPlanEstimate = 0;

		var totalArtifactComplete = 0;

		Ext.Array.each(stories, function(story) {
			totalPlanEstimate += story.get('PlanEstimate');

			if ((story.get('ScheduleState') === 'Ready to Ship') || (story.get('ScheduleState') === 'Accepted')) {
				totalArtifactComplete += story.get('PlanEstimate');
			}
		});

		Ext.Array.each(defects, function(defect) {
			totalPlanEstimate += defect.get('PlanEstimate');

			if ((defect.get('ScheduleState') === 'Ready to Ship') || (defect.get('ScheduleState') === 'Accepted')) {
				totalArtifactComplete += defect.get('PlanEstimate');
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			totalPlanEstimate += testSet.get('PlanEstimate');

			if ((testSet.get('ScheduleState') === 'Ready to Ship') || (testSet.get('ScheduleState') === 'Accepted')) {
				totalArtifactComplete += testSet.get('PlanEstimate');
			}
		});

		console.log('total plan estimate:', totalPlanEstimate);
		console.log('total artifact complete:', totalArtifactComplete);

		var result;

		if (totalPlanEstimate != 0) {
			result = Math.floor((totalArtifactComplete / totalPlanEstimate) * 100) + '%';
		} else {
			result = 'N/A';
		}

		return result;
	},


	_calculateStoriesLeft: function(stories, defects, testSets) {
		var totalLeft = 0;

		Ext.Array.each(stories, function(story) {
			if ((story.get('ScheduleState') !== 'Ready to Ship') && (story.get('ScheduleState') !== 'Accepted')) {
				totalLeft +=1;
			}
		});

		Ext.Array.each(defects, function(defect) {
			if ((defect.get('ScheduleState') !== 'Ready to Ship') && (defect.get('ScheduleState') !== 'Accepted')) {
				totalLeft +=1;
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if ((testSet.get('ScheduleState') !== 'Ready to Ship') && (testSet.get('ScheduleState') !== 'Accepted')) {
				totalLeft +=1;
			}
		});

		return totalLeft;
	},


	_calculateTotalPlanEstimate: function(stories, defects, testSets) {
		var totalPlanEstimate = 0;

		Ext.Array.each(stories, function(story) {
			if ((story.get('ScheduleState') != 'Ready to Ship') && (story.get('ScheduleState') != 'Accepted')) {
				totalPlanEstimate += story.get('PlanEstimate');
			}
		});

		Ext.Array.each(defects, function(defect) {
			if ((defect.get('ScheduleState') != 'Ready to Ship') && (defect.get('ScheduleState') != 'Accepted')) {
				totalPlanEstimate += defect.get('PlanEstimate');
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if ((testSet.get('ScheduleState') != 'Ready to Ship') && (testSet.get('ScheduleState') != 'Accepted')) {
				totalPlanEstimate += testSet.get('PlanEstimate');
			}
		});

		return totalPlanEstimate;
	},


	_calculateStoriesBlocked: function(stories, defects, testSets) {
		var totalBlocked = 0;

		Ext.Array.each(stories, function(story) {
			if (story.get('Blocked')) {
				totalBlocked +=1;
			}
		});

		Ext.Array.each(defects, function(defect) {
			if (defect.get('Blocked')) {
				totalBlocked +=1;
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if (testSet.get('Blocked')) {
				totalBlocked +=1;
			}
		});

		return totalBlocked;
	},


	_calculateTotalPlanEstimateBlocked: function(stories, defects, testSets) {
		var totalPlanEstimate = 0;

		Ext.Array.each(stories, function(story) {
			if (story.get('Blocked')) {
				totalPlanEstimate += story.get('PlanEstimate');
			}
		});

		Ext.Array.each(defects, function(defect) {
			if (defect.get('Blocked')) {
				totalPlanEstimate += defect.get('PlanEstimate');
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if (testSet.get('Blocked')) {
				totalPlanEstimate += testSet.get('PlanEstimate');
			}
		});

		return totalPlanEstimate;
	},


	_calculateStoriesCompleted: function(stories, defects, testSets) {
		var totalCompleted = 0;

		Ext.Array.each(stories, function(story) {
			if (story.get('ScheduleState') == 'Completed') {
				totalCompleted +=1;
			}
		});

		Ext.Array.each(defects, function(defect) {
			if (defect.get('ScheduleState') == 'Completed') {
				totalCompleted +=1;
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if (testSet.get('ScheduleState') == 'Completed') {
				totalCompleted +=1;
			}
		});

		return totalCompleted;
	},


	_calculateTotalPlanEstimateCompleted: function(stories, defects, testSets) {
		var totalPlanEstimate = 0;

		Ext.Array.each(stories, function(story) {
			if (story.get('ScheduleState') == 'Completed') {
				totalPlanEstimate += story.get('PlanEstimate');
			}
		});

		Ext.Array.each(defects, function(defect) {
			if (defect.get('ScheduleState') == 'Completed') {
				totalPlanEstimate += defect.get('PlanEstimate');
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if (testSet.get('ScheduleState') == 'Completed') {
				totalPlanEstimate += testSet.get('PlanEstimate');
			}
		});

		return totalPlanEstimate;
	},


	_calculateDefectsOpen: function(defects) {
		var totalOpen = 0;

		Ext.Array.each(defects, function(defect) {
			if ((defect.get('ScheduleState') != 'Completed') && (defect.get('ScheduleState') != 'Accepted') && (defect.get('ScheduleState') != 'Ready to Ship')) {
				totalOpen +=1;
			}
		});

		return totalOpen;
	},


	_calculateTotalPlanEstimateDefectsOpen: function(defects) {
		var totalPlanEstimate = 0;

		Ext.Array.each(defects, function(defect) {
			if ((defect.get('ScheduleState') != 'Completed') && (defect.get('ScheduleState') != 'Accepted') && (defect.get('ScheduleState') != 'Ready to Ship')) {
				totalPlanEstimate += defect.get('PlanEstimate');
			}
		});

		return totalPlanEstimate;
	},

	
});