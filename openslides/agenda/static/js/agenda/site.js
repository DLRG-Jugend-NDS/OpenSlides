(function () {

'use strict';

angular.module('OpenSlidesApp.agenda.site', ['OpenSlidesApp.agenda'])

.config([
    'mainMenuProvider',
    'gettext',
    function (mainMenuProvider, gettext) {
        mainMenuProvider.register({
            'ui_sref': 'agenda.item.list',
            'img_class': 'calendar-o',
            'title': gettext('Agenda'),
            'weight': 200,
            'perm': 'agenda.can_see',
        });
    }
])

.config([
    '$stateProvider',
    function($stateProvider) {
        $stateProvider
            .state('agenda', {
                url: '/agenda',
                abstract: true,
                template: "<ui-view/>",
            })
            .state('agenda.item', {
                abstract: true,
                template: "<ui-view/>",
            })
            .state('agenda.item.list', {
                resolve: {
                    items: function(Agenda) {
                        return Agenda.findAll();
                    }
                }
            })
            .state('agenda.item.detail', {
                resolve: {
                    item: function(Agenda, $stateParams) {
                        return Agenda.find($stateParams.id);
                    },
                    users: function(User) {
                        return User.findAll();
                    },
                    tags: function(Tag) {
                        return Tag.findAll();
                    }
                }
            })
            .state('agenda.item.sort', {
                resolve: {
                    items: function(Agenda) {
                        return Agenda.findAll();
                    }
                },
                url: '/sort',
                controller: 'AgendaSortCtrl',
            })
            .state('agenda.item.import', {
                url: '/import',
                controller: 'AgendaImportCtrl',
            });
    }
])

.controller('ItemListCtrl', [
    '$scope',
    '$http',
    '$state',
    'ngDialog',
    'Agenda',
    'AgendaTree',
    'Customslide',
    'Projector',
    function($scope, $http, $state, ngDialog, Agenda, AgendaTree, Customslide, Projector) {
        // Bind agenda tree to the scope
        $scope.$watch(function () {
            return Agenda.lastModified();
        }, function () {
            $scope.items = AgendaTree.getFlatTree(Agenda.getAll());
        });
        $scope.alert = {};

        // open new dialog
        $scope.newDialog = function () {
            ngDialog.open({
                template: 'static/templates/core/customslide-form.html',
                controller: 'CustomslideCreateCtrl',
                className: 'ngdialog-theme-default wide-form'
            });
        };
        // open edit dialog
        $scope.editDialog = function (item) {
            $state.go(item.content_object.collection.replace('/','.')+'.detail.update',
                        {id: item.content_object.id});
        };
        // detail view of related item (content object)
        $scope.open = function (item) {
            $state.go(item.content_object.collection.replace('/','.')+'.detail',
                {id: item.content_object.id});
        };
        // save changed item
        $scope.save = function (item) {
            Agenda.save(item).then(
                function(success) {
                    item.quickEdit = false;
                    $scope.alert.show = false;
                },
                function(error){
                    var message = '';
                    for (var e in error.data) {
                        message += e + ': ' + error.data[e] + ' ';
                    }
                    $scope.alert = { type: 'danger', msg: message, show: true };
                });
        };
        // delete related item
        $scope.deleteRelatedItem = function (item) {
            if (item.content_object.collection == 'core/customslide') {
                Customslide.destroy(item.content_object.id);
            }
        };

        // *** delete mode functions ***
        $scope.isDeleteMode = false;
        // check all checkboxes
        $scope.checkAll = function () {
            angular.forEach($scope.items, function (item) {
                item.selected = $scope.selectedAll;
            });
        };
        // uncheck all checkboxes if isDeleteMode is closed
        $scope.uncheckAll = function () {
            if (!$scope.isDeleteMode) {
                $scope.selectedAll = false;
                angular.forEach($scope.items, function (item) {
                    item.selected = false;
                });
            }
        };
        // delete selected items only if items are customslides
        $scope.delete = function () {
            angular.forEach($scope.items, function (item) {
                if (item.selected) {
                    if (item.content_object.collection == 'core/customslide') {
                        Customslide.destroy(item.content_object.id);
                    }
                }
            });
            $scope.isDeleteMode = false;
            $scope.uncheckAll();
        };

        // project agenda
        $scope.projectAgenda = function () {
            $http.post('/rest/core/projector/1/prune_elements/',
                    [{name: 'agenda/item-list'}]);
        };
        // check if agenda is projected
        $scope.isAgendaProjected = function () {
            // Returns true if there is a projector element with the name
            // 'agenda/item-list'.
            var projector = Projector.get(1);
            if (typeof projector === 'undefined') return false;
            var self = this;
            var predicate = function (element) {
                return element.name == 'agenda/item-list';
            };
            return typeof _.findKey(projector.elements, predicate) === 'string';
        };
        // auto numbering of agenda items
        $scope.autoNumbering = function() {
            $http.post('/rest/agenda/item/numbering/', {});
        };
    }
])

.controller('ItemDetailCtrl', [
    '$scope',
    '$filter',
    '$http',
    '$state',
    'operator',
    'Agenda',
    'User',
    'item',
    function ($scope, $filter, $http, $state, operator, Agenda, User, item) {
        Agenda.bindOne(item.id, $scope, 'item');
        User.bindAll({}, $scope, 'users');
        $scope.speakerSelectBox = {};
        $scope.alert = {};
        $scope.speakers = $filter('orderBy')(item.speakers, 'weight');
        $scope.$watch(function () {
            return Agenda.lastModified();
        }, function () {
            $scope.speakers = $filter('orderBy')(item.speakers, 'weight');
        });

        // go to detail view of related item (content object)
        $scope.open = function (item) {
            $state.go(item.content_object.collection.replace('/','.')+'.detail',
                {id: item.content_object.id});
        };

        // close/open list of speakers of current item
        $scope.closeList = function (listClosed) {
            item.speaker_list_closed = listClosed;
            Agenda.save(item);
        };

        // add user to list of speakers
        $scope.addSpeaker = function (userId) {
            $http.post('/rest/agenda/item/' + item.id + '/manage_speaker/', {'user': userId})
            .success(function (data){
                $scope.alert.show = false;
                $scope.speakers = item.speakers;
                $scope.speakerSelectBox = {};
            })
            .error(function (data){
                $scope.alert = {type: 'danger', msg: data.detail, show: true};
                $scope.speakerSelectBox = {};
            });
        };

        // delete speaker(!) from list of speakers
        $scope.removeSpeaker = function (speakerId) {
            $http.delete(
                '/rest/agenda/item/' + item.id + '/manage_speaker/',
                {headers: {'Content-Type': 'application/json'},
                 data: JSON.stringify({speaker: speakerId})}
            )
            .success(function(data){
                $scope.speakers = item.speakers;
            })
            .error(function(data){
                $scope.alert = { type: 'danger', msg: data.detail, show: true };
            });
            $scope.speakers = item.speakers;
        };

        // check if user is allowed to see 'add me' / 'remove me' button
        $scope.isAllowed = function (action) {
            var nextUsers = [];
            var nextSpeakers = $filter('filter')($scope.speakers, {'begin_time': null});
            angular.forEach(nextSpeakers, function (speaker) {
                nextUsers.push(speaker.user_id);
            });
            if (action == 'add') {
                return (operator.hasPerms('agenda.can_be_speaker') &&
                        !item.speaker_list_closed &&
                        $.inArray(operator.user.id, nextUsers) == -1);
            }
            if (action == 'remove') {
                return ($.inArray(operator.user.id, nextUsers) != -1);
            }
        }

        // begin speech of selected/next speaker
        $scope.beginSpeech = function (speakerId) {
            $http.put('/rest/agenda/item/' + item.id + '/speak/', {'speaker': speakerId})
            .success(function(data){
                $scope.alert.show = false;
            })
            .error(function(data){
                $scope.alert = { type: 'danger', msg: data.detail, show: true };
            });
        };

        // end speech of current speaker
        $scope.endSpeech = function () {
            $http.delete(
                '/rest/agenda/item/' + item.id + '/speak/',
                {headers: {'Content-Type': 'application/json'}, data: JSON.stringify()}
            )
            .error(function(data){
                $scope.alert = { type: 'danger', msg: data.detail, show: true };
            });
        };
        // gets speech duration of selected speaker in seconds
        $scope.getDuration = function (speaker) {
            var beginTimestamp = new Date(speaker.begin_time).getTime()
            var endTimestamp = new Date(speaker.end_time).getTime()
            // calculate duration in seconds
            return Math.floor((endTimestamp - beginTimestamp) / 1000);

        }
        // save reordered list of speakers
        $scope.treeOptions = {
            dropped: function (event) {
                var sortedSpeakers = [];
                var nextSpeakers = $filter('filter')($scope.speakers, {'begin_time': null});
                angular.forEach(nextSpeakers, function (speaker) {
                    sortedSpeakers.push(speaker.id);
                });
                $http.post('/rest/agenda/item/' + item.id + '/sort_speakers/',
                    {speakers: sortedSpeakers}
                );
            }
        };
    }
])

.controller('AgendaSortCtrl', [
    '$scope',
    '$http',
    'Agenda',
    'AgendaTree',
    function($scope, $http, Agenda, AgendaTree) {
        // Bind agenda tree to the scope
        $scope.$watch(function () {
            return Agenda.lastModified();
        }, function () {
            $scope.items = AgendaTree.getTree(Agenda.getAll());
        });

        // set changed agenda tree
        $scope.treeOptions = {
            dropped: function() {
                $http.put('/rest/agenda/item/tree/', {tree: $scope.items});
            }
        };
    }
])

.controller('AgendaImportCtrl', [
    '$scope',
    'gettext',
    'Agenda',
    'Customslide',
    function($scope, gettext, Agenda, Customslide) {
        // import from textarea
        $scope.importByLine = function () {
            $scope.titleItems = $scope.itemlist[0].split("\n");
            $scope.importcounter = 0;
            $scope.titleItems.forEach(function(title) {
                var item = {title: title};
                // TODO: create all items in bulk mode
                Customslide.create(item).then(
                    function(success) {
                        $scope.importcounter++;
                    }
                );
            });
        };

        // *** CSV import ***
        // set initial data for csv import
        $scope.items = []
        $scope.separator = ',';
        $scope.encoding = 'UTF-8';
        $scope.encodingOptions = ['UTF-8', 'ISO-8859-1'];
        $scope.csv = {
            content: null,
            header: true,
            headerVisible: false,
            separator: $scope.separator,
            separatorVisible: false,
            encoding: $scope.encoding,
            encodingVisible: false,
            result: null
        };
        // set csv file encoding
        $scope.setEncoding = function () {
            $scope.csv.encoding = $scope.encoding;
        };
        // set csv file encoding
        $scope.setSeparator = function () {
            $scope.csv.separator = $scope.separator;
        };
        // detect if csv file is loaded
        $scope.$watch('csv.result', function () {
            $scope.items = [];
            var quotionRe = /^"(.*)"$/;
            angular.forEach($scope.csv.result, function (item) {
                // title
                if (item.title) {
                    item.title = item.title.replace(quotionRe, '$1');
                }
                if (!item.title) {
                    item.importerror = true;
                    item.title_error = gettext('Error: Title is required.');
                }
                // text
                if (item.text) {
                    item.text = item.text.replace(quotionRe, '$1');
                }
                $scope.items.push(item);
            });
        });

        // import from csv file
        $scope.import = function () {
            $scope.csvImporting = true;
            angular.forEach($scope.items, function (item) {
                if (!item.importerror) {
                    Customslide.create(item).then(
                        function(success) {
                            item.imported = true;
                        }
                    );
                }
            });
            $scope.csvimported = true;
        };
        $scope.clear = function () {
            $scope.csv.result = null;
        };
        // download CSV example file
        $scope.downloadCSVExample = function () {
            var element = document.getElementById('downloadLink');
            var csvRows = [
                // column header line
                ['title', 'text'],
                // example entries
                ['Demo 1', 'Demo text 1'],
                ['Demo 2', 'Demo text 2']

            ];
            var csvString = csvRows.join("%0A");
            element.href = 'data:text/csv;charset=utf-8,' + csvString;
            element.download = 'agenda-example.csv';
            element.target = '_blank';
        }
     }
]);

}());