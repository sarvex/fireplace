var jsuri = localRequire('node_modules/jsuri/Uri');


function assertSelectedDevice(test, device) {
    // Ask the module if our device filter is active.
    test.assert(casper.evaluate(function(device) {
        return window.require('compat_filter').isDeviceSelected(device);
    }, device), 'Check filtering device is ' + (device || 'all'));
}


appList.appListPages.forEach(function(appListPage) {
    if (!appListPage.appLimit) {
        appListPage.appLimit = constants.APP_LIMIT;
    }

    if (!appListPage.noCompatFiltering) {
        casper.test.begin('Test ' + appListPage.name + ' compat filter', {
            test: function(test) {
                helpers.startCasper({
                    path: new jsuri(appListPage.path)
                });

                if (appListPage.login) {
                    helpers.waitForPageLoaded(function() {
                        helpers.fake_login();
                        helpers.waitForPageLoaded(testCompatFiltering);
                    });
                } else {
                    helpers.waitForPageLoaded(testCompatFiltering);
                }

                function testCompatFiltering() {
                    // Test field is correct if device filtering present.
                    test.assertVisible('.compat-select-wrapper');
                    helpers.selectOption('#compat-filter', 'desktop');
                    assertSelectedDevice(test, 'desktop');

                    // Test API call.
                    var endpointParams = appList.getEndpointParams(appListPage, {
                        dev: 'desktop'
                    });

                    casper.waitForSelector('.app-list', function() {
                        helpers.assertAPICallWasMade(appListPage.endpoint,
                                                     endpointParams);

                        // Test basic count during device filtering.
                        test.assertExists(
                            appList.appNthChild(appListPage.appLimit - 1));
                        test.assertNotExists(
                            appList.appNthChild(appListPage.appLimit + 1));

                        if (!appListPage.noLoadMore) {
                            appList.waitForLoadMore(function() {
                                assertSelectedDevice(test, 'desktop');
                            });
                        }
                    });
                }

                helpers.done(test);
            }
        });
    }
});


casper.test.begin('Test compat filter dropdown options', {
    test: function(test) {
        helpers.startCasper(new jsuri('/search').addQueryParam('q', 'foo'));

        helpers.waitForPageLoaded(function() {
            test.assertExists('#compat-filter [value="all"]');
            test.assertExists('#compat-filter [value="desktop"]');
            test.assertExists('#compat-filter [value="firefoxos"]');
            test.assertExists('#compat-filter [value="android-mobile"]');
            test.assertExists('#compat-filter [value="android-tablet"]');
        });

        helpers.done(test);
    }
});


casper.test.begin('Test compat filter dropdown change', {
    test: function(test) {
        helpers.startCasper(new jsuri('/search').addQueryParam('q', 'foo'));

        helpers.waitForPageLoaded(function() {
            assertSelectedDevice(test, '');
            helpers.selectOption('#compat-filter', 'firefoxos');
            assertSelectedDevice(test, 'firefoxos');
        });

        helpers.done(test);
    }
});


casper.test.begin('Test compat filter dropdown persist for site', {
    test: function(test) {
        helpers.startCasper(new jsuri('/search').addQueryParam('q', 'foo'));

        helpers.waitForPageLoaded(function() {
            helpers.selectOption('#compat-filter', 'firefoxos');
            casper.click('.back');
        });

        casper.waitForSelector('[data-page-type~="homepage"]', function() {
            casper.click('.popular a');
        });

        casper.waitForSelector('.app-list', function() {
            // Still FirefoxOS.
            assertSelectedDevice(test, 'firefoxos');
        });

        helpers.done(test);
    }
});


casper.test.begin('Test compat filter dropdown persists between sessions', {
    test: function(test) {
        helpers.startCasper(new jsuri('/search').addQueryParam('q', 'foo'));

        helpers.waitForPageLoaded(function() {
            helpers.selectOption('#compat-filter', 'firefoxos');
            casper.thenOpen(helpers.makeUrl('/popular'));
        });

        casper.waitForSelector('[data-page-type~="popular"]', function() {
            assertSelectedDevice(test, 'firefoxos');
        });

        helpers.done(test);
    }
});


casper.test.begin('Test compat filtering persists after search', {
    test: function(test) {
        helpers.startCasper({path: '/search?q=test'});

        helpers.waitForPageLoaded(function() {
            helpers.selectOption('#compat-filter', 'desktop');
            assertSelectedDevice(test, 'desktop');

            casper.fill('.search', {q: 'test'}, true);

            casper.waitForSelector('.app-list', function() {
                casper.waitForUrl(/\/search\?q=test$/, function() {
                    assertSelectedDevice(test, 'desktop');
                });
            });
        });

        helpers.done(test);
    }
});


casper.test.begin('Test UA compat filter change', {
    test: function(test) {
        helpers.startCasper('/popular');

        helpers.waitForPageLoaded(function() {
            helpers.assertUASetSessionVar(test, ['dimension2', '']);

            helpers.selectOption('#compat-filter', 'firefoxos');
            test.assert(helpers.filterUALogs([
                'send',
                'event',
                'Change platform filter',
                'click',
                'firefoxos'
            ]).length > 0, 'Test change platform filter event');

            helpers.assertUASetSessionVar(test, ['dimension2', 'firefoxos']);
        });

        helpers.done(test);
    }
});
