Ext.define('CustomApp', {
	extend: 'Rally.app.App',
	componentCls: 'app',
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

		var milestoneComboBox = Ext.create('Rally.ui.combobox.MilestoneComboBox', {
			fieldLabel: 'Choose Milestone',
			multiSelect: true,
			width: 250,
			itemId: 'milestoneComboBox',
			allowClear: true,
			scope: this,
			listeners: {
				ready: function(combobox) {
					console.log('ready: ', combobox);
				},
				select: function(combobox, records, opts) {
					console.log('select:', records.length);

					var reportStore = Ext.create('Ext.data.JsonStore', {
						fields: ['milestonename', 
								'percentComplete', 
								'storiesLeft', 
								'totalPlanEstimate', 
								'blocked', 
								'totalPlanBlocked', 
								'storiesCompleted', 
								'totalPlanEstimateCompleted', 
								'targetDate']
					});					

					this.myMask.show();
					var promises = [];

					for (var i = 0; i < records.length ; i++) {

						var deferred = Ext.create('Deft.Deferred');

						promises.push(deferred);
							this._assignInitValues(records, i).then({
								success: function() {
									return this._loadStories();
								},
								scope: this
							}).then({
								success: function() {
									return this._loadDefects();
								},
								scope: this
							}).then({
								success: function() {
									return this._loadTestSets();
								},
								scope: this
							}).then({
								success: function() {
									reportStore.add(this._getStoreData());

									console.log('report loaded:', reportStore);
									return deferred.resolve();
								},
								scope: this
							});
					}

					Deft.Promise.all(promises).then( {
						success: function() {

							console.log('creating grid');
							console.log('report store:', reportStore);

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

		var filterPanel = Ext.create('Ext.panel.Panel', {
			layout: 'hbox',
			align: 'stretch',
			padding: 5,
			itemId: 'filterPanel',
		});

		filterPanel.add(milestoneComboBox);

		this.add(filterPanel);

		this.add(mainPanel);
	},

	_assignInitValues: function(records, i) {
		var deferred = Ext.create('Deft.Deferred');

		console.log('select:', records[i].get('ObjectID'));
		console.log('select:', records[i].get('Name'));

		this.milestoneId = records[i].get('ObjectID');

		this.milestoneName = records[i].get('Name');
		this.targetDate = records[i].get('TargetDate');

		setTimeout(function afterTwoSeconds() {
			deferred.resolve();
		}, 500)


		
		return deferred.promise;
	},


	_getStoreData: function() {
		console.log('Milesone Name:', this.milestoneName);
		console.log('Local stories:', this.stories);
		console.log('Local defects:', this.defects);
		console.log('Local testSets:', this.testSets);

		var percentComplete = this._calculatePercentComplete(this.stories, this.defects, this.testSets);
		var storiesLeft = this._calculateStoriesLeft(this.stories, this.defects, this.testSets);
		var totalPlanEstimate = this._calculateTotalPlanEstimate(this.stories, this.defects, this.testSets);
		var storiesBlocked = this._calculateStoriesBlocked(this.stories, this.defects, this.testSets);
		var totalPlanEstimateBlocked = this._calculateTotalPlanEstimateBlocked(this.stories, this.defects, this.testSets);
		var storiesCompleted = this._calculateStoriesCompleted(this.stories, this.defects, this.testSets);
		var totalPlanEstimateCompleted = this._calculateTotalPlanEstimateCompleted(this.stories, this.defects, this.testSets);

		var targetDate = this.targetDate;

		row = {
			milestonename: this.milestoneName,
			percentComplete: percentComplete,
			storiesLeft: storiesLeft,
			totalPlanEstimate: totalPlanEstimate,
			blocked: storiesBlocked,
			totalPlanBlocked: totalPlanEstimateBlocked,
			storiesCompleted: storiesCompleted,
			totalPlanEstimateCompleted: totalPlanEstimateCompleted,
			targetDate: targetDate
		}

		console.log('milestone row:', row);

		return row;
	},


	_calculatePercentComplete: function(stories, defects, testSets) {
		var totalPlanEstimate = 0;

		var totalArtifactComplete = 0;

		Ext.Array.each(stories, function(story) {
			totalPlanEstimate += story.get('PlanEstimate')

			if ((story.get('ScheduleState') == 'Ready to Ship') || (story.get('ScheduleState') == 'Accepted')) {
				totalArtifactComplete += story.get('PlanEstimate');
			}
		});

		Ext.Array.each(defects, function(defect) {
			totalPlanEstimate += defect.get('PlanEstimate')

			if ((defect.get('ScheduleState') == 'Ready to Ship') || (defect.get('ScheduleState') == 'Accepted')) {
				totalArtifactComplete += defect.get('PlanEstimate');
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			totalPlanEstimate += testSet.get('PlanEstimate')

			if ((testSet.get('ScheduleState') == 'Ready to Ship') || (testSet.get('ScheduleState') == 'Accepted')) {
				totalArtifactComplete += testSet.get('PlanEstimate');
			}
		});

		console.log('total plan estimate:', totalPlanEstimate);
		console.log('total artifact complete:', totalArtifactComplete);
		return Math.floor((totalArtifactComplete / totalPlanEstimate) * 100) + '%' ;
	},


	_calculateStoriesLeft: function(stories, defects, testSets) {
		var totalLeft = 0;

		Ext.Array.each(stories, function(story) {
			if ((story.get('ScheduleState') != 'Ready to Ship') && (story.get('ScheduleState') != 'Accepted')) {
				totalLeft +=1
			}
		});

		Ext.Array.each(defects, function(defect) {
			if ((defect.get('ScheduleState') != 'Ready to Ship') && (defect.get('ScheduleState') != 'Accepted')) {
				totalLeft +=1
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if ((testSet.get('ScheduleState') != 'Ready to Ship') && (testSet.get('ScheduleState') != 'Accepted')) {
				totalLeft +=1
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
				totalBlocked +=1
			}
		});

		Ext.Array.each(defects, function(defect) {
			if (defect.get('Blocked')) {
				totalBlocked +=1
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if (testSet.get('Blocked')) {
				totalBlocked +=1
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
				totalCompleted +=1
			}
		});

		Ext.Array.each(defects, function(defect) {
			if (defect.get('ScheduleState') == 'Completed') {
				totalCompleted +=1
			}
		});

		Ext.Array.each(testSets, function(testSet) {
			if (testSet.get('ScheduleState') == 'Completed') {
				totalCompleted +=1
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


	_loadStories: function() {
		var deferred = Ext.create('Deft.Deferred');

		var storiesStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'HierarchicalRequirement',
			fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'Blocked'],
			filters: [{
				property: 'PortfolioItem.Milestones',
				operator: 'contains',
				value: "/milestone/" + this.milestoneId
			}],
			limit: Infinity
		});

		storiesStore.load().then({
			success: function(records) {
				this.stories = records;
				console.log('Stories:', records);
				deferred.resolve(records);

			},
			scope: this
		});

		return deferred.promise;
	},


	_loadDefects: function() {
		var deferred = Ext.create('Deft.Deferred');
		var defectsStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'Defect',
			fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'Blocked'],
			filters: [{
				property: 'Milestones',
				operator: 'contains',
				value: "/milestone/" + this.milestoneId
			}],
			limit: Infinity
		});

		defectsStore.load().then({
			success: function(records) {
				this.defects = records;
				console.log('Defects:', records);
				deferred.resolve(records);

			},
			scope: this
		});
		return deferred.promise;
	},


	_loadTestSets: function() {
		var deferred = Ext.create('Deft.Deferred');
		var testStore = Ext.create('Rally.data.WsapiDataStore', {
			model: 'TestSet',
			fetch: ['FormattedID', 'Name', 'ObjectID', 'ScheduleState', 'PlanEstimate', 'Blocked'],
			filters: [{
				property: 'Milestones',
				operator: 'contains',
				value: "/milestone/" + this.milestoneId
			}],
			limit: Infinity
		});

		testStore.load().then({
			success: function(records) {
				this.testSets = records;
				console.log('testStore:', records);
				deferred.resolve(records);

			},
			scope: this
		});
		return deferred.promise;
	}
});