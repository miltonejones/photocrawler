class ModelList {
    constructor() {
        this.dirty = false;
        this.Items = null;
        this.API = new AppResource()
    }

    read() {
        const existing = localStorage['model-object'];
        if (existing && existing.length) {
            const data = JSON.parse(existing);
            const when = new Date(data.date);
            const now = new Date();
            const diff = (now - when) / 1000;
            if (diff < 86400) {
                return data;
            }
        }
    }

    load() {
        const old = this.read();//localStorage['model-x'];
        if (this.Items) return Promise.resolve(`${this.Items.length} models ALREADY loaded`);
        return new Promise(resolve => {
            if (old) {
                this.Items = old.models;
                DomHelper.status(`${this.Items.length} models loaded FROM ${old.date} CACHE`);
                return resolve();
            }
            this.API.Services.Model.get({ photo: 1 }, models => {
                const str = JSON.stringify({ date: new Date().toString(), models: models.data });
                this.Items = models.data;
                DomHelper.status(`${this.Items.length} models loaded, ${str.length} bytes of data`);
                localStorage['model-object'] = str;
                resolve()
            })
        })
    }

    reload() {
        this.Items = null;
        return this.load()
    }

    add(model) {
        this.Items.push(model)
    }

    getModels(nameList) {
        return this.Items.filter(item => nameList.filter(name => item.name == name).length);
    }

    getModel(name) {
        return this.Items.filter(f => name && f.name && f.name.toLowerCase() == name.toLowerCase())[0];
    }

    setModelImage(model, image) {
        this.Items.map(star => {
            if (star.ID == model.ID) star.image = image;
        })
    }
}

class Application {
    constructor() {
        this.body = {
            state: null,
            page: 1,
            excluded: [],
            model: null,
            multiple: false,
            cachedPage: null,
            fails: 0,
            newest: false
        }
        this.storageName = Session.Key;
    }

    reset() {
        this.write(this.body)
    }

    read() {
        const app = localStorage[this.storageName];
        if (app) return JSON.parse(app);
        return this.body;
    }

    write(app) {
        localStorage[this.storageName] = JSON.stringify(app)
    }

    static getApplication() {
        return new Application().read()
    }

    static save(app) {
        new Application().write(app)
    }

    static renew() {
        var app = Application.getApplication()
        app.page = 1;
        app.cachedPage = null
        app.fails = 0;
        app.excluded = []
        Application.save(app)
    }

    static omit(Key) {
        var app = Application.getApplication()
        if (app.excluded.filter(f => f == Key).length) return;
        console.warn("excluding item '%s'", Key)
        app.excluded.push(Key)
        Application.save(app)
    }
}

class VideoHelper {
    constructor() {
        this.API = new AppResource()
        this.states = { CANCELLED: -1 }
        this.UI = new UserInterfaceHelper();
        this.maximumFails = 100;
        this.state = 0;
        this.page = 1;
        this.alreadyChecked = []
    }

    addJavItems(items, fn) {
        if (!items.length) return !fn ? null : fn();
        const promises = [];
        const item = items.pop();
        const payload = { URL: item.URL };
        console.warn({ payload })
        this.API.Services.Video.put(payload, answer => {
            console.warn({ answer });
            this.addJavItems(items, fn);
        });
    }

    javpetite() {

        const _this = this;
        let payload = { jpage: this.page };
        this.API.Services.Video.get(payload, function (keyList) {

            keyList = keyList.filter(i => _this.alreadyChecked.indexOf(i) < 0);

            keyList.map(i => _this.alreadyChecked.push(i));

            console.log({ keyList })
            return _this.API.Services.Video.put({ keyList }, records => {
                var existingTracks = records.rows;

                if (existingTracks && existingTracks.length) {
                    console.log(existingTracks)

                    existingTracks.map(f => {
                        var htm = $(`<div class="video" data-url="${f.URL}">
                            <a href="javascript:void(0)" title="${f.title}">   
                            <img src="${f.image}" style="width:180px;height:auto" border="0">
                            <div class="title">${f.title}</div>
                            </a> 
                        </div>`)
                        $('div.videos').append(htm)
                    })


                    keyList = keyList.filter(track => {
                        let exists = !existingTracks.filter(existing => existing.title.toLowerCase().indexOf(track.toLowerCase()) >= 0).length;
                        return exists
                    })

                    console.log(keyList)

                    WebSearcher.SearchAllKeys(keyList)
                        .then(candidates => {
                            console.log({ candidates })




                            if (candidates && candidates.length) {
                                var worked = candidates.filter(candidate => !!candidate)
                                console.log({ worked })

                                if (worked && worked.length) {
                                    _this.addJavItems(worked, () => {
                                        if (++_this.page < 15) return _this.javpetite();
                                        console.warn("DONE")
                                    })
                                    return;
                                }

                                _this.page++;
                                if (_this.page < 5) _this.javpetite();
                            }

                        })

                }
            })

        })
    }

    adapt() {
        $('div.video').remove()
        this.javpetite()
    }

    start() {
        LocalModel.load()
            .then(() => {
                Application.renew()
                this.downloadVideoPageFromDb()
            })
    }

    whois() {
        LocalModel.load()
            .then(() => {
                Application.renew()
                this.getNextWho()
            })
    }

    check() {
        LocalModel.load()
            .then(() => this.loadInfoFromPage())
            .then((track) => this.loadElements(track))
    }

    search() {
        new Application().reset()
        var app = Application.getApplication()
        var beginSearch = (model) => this.beginSearch(app, model)
        this.searchButtons()
        LocalModel.load()
            .then(() => DomHelper.getModelOnDetailPagebyName())
            .then(beginSearch)
    }

    javauto() {

        if (!KeysNotOnPage && KeysNotOnPage.length) return;

        var re, map = {
            screen: /en\/(\w+\.php)/,
            s: /s=(\w+)/,
            g: /g=(\w+)/,
            d: /d=(\w+)/,
            m: /m=(\w+)/,
            l: /l=(\w+)/,
            keyword: /keyword=(\w+)/,
            page: /page=(\w+)/
        }, out = {};
        for (var n in map) {
            if (re = map[n].exec(location.href)) {
                out[n] = re[1]
            }
        }

        if (!out.page) out.page = 1;
        out.title = $('.boxtitle').text()

        var addedHref = btoa(JSON.stringify(out));

        var locale = `https://javdoe.tv#${KeysNotOnPage.join('/')}*${addedHref}`;

        return location.href = locale;
    }

    javdoe() {
        if (!KeysNotOnPage && KeysNotOnPage.length) return;
        var locale = `https://javdoe.tv#${KeysNotOnPage.join('/')}`;
        window.open(locale);
    }

    beginSearch(app, model) {
        console.log({ model })
        $('div.video').remove()
        app.page = 1;
        app.candidates = []
        app.model = model;
        Application.save(app)
        this.searchVideoPage()
    }

    searchButtons() {
        const buttons = [
            {
                label: 'Stop Searching',
                agent: this,
                action: 'cancelSearch'
            }
        ]
        const boxes = [
            {
                id: 'auto-import',
                label: 'Auto-import'
            }
        ]
        this.UI.draw(buttons);
        this.UI.check(boxes);
    }

    static previewImport() {
        return $('#import-preview:checked').length
    }

    importButtons() {
        var start = () => {
            var app = Application.getApplication();
            this.importCandidates(app.candidates, app.model)
        }
        var command = { start }
        const buttons = [
            {
                label: 'Add Videos',
                agent: command,
                action: 'start'
            }
        ]

        this.UI.draw(buttons);
    }

    autoImport() {
        return $('#auto-import:checked').length;
    }

    findFromPage(Key) {
        return WebSearcher.searchByKey(Key)
            .then(candidate => {
                if (candidate) {
                    var div = $(`<div id="video_id" class="item">
                        <table>
                        <tbody><tr>
                            <td class="header">Import:</td>
                            <td class="text"><img style="width:180px;height:auto" src="${candidate.Photo}"></td>
                        </tr>
                        </tbody></table>
                        </div>`)
                    div.click(function () {
                        DatabaseHelper.addSingleCandidate(candidate);
                    })
                    return $("#video_info").append(div)
                }
                $("#video_info").append(`<div id="video_id" class="item">
                    <table>
                    <tbody><tr>
                        <td class="header">Javdoe.com:</td>
                        <td class="text">${DomHelper.javdoe(Key)}</td>
                    </tr>
                    </tbody></table>
                    </div>`)
            })
    }

    loadElements(track) {

        return new Promise(resolve => {

            const modelLinks = DomHelper.getModelLinksOnPage();
            var Key = DomHelper.getKeyOnDetailPage()
            if (!track) {
                return this.findFromPage(Key)
            }

            this.getModelsFromKeys(track)

            const filteredModelList = modelLinks.filter(function (f) {
                var v = track.models.filter(function (e) {
                    return e.name == f.name
                })
                return !v.length
            })

            if (filteredModelList.length) {
                return this.getModels(filteredModelList, [])
                    .then(models => this.setModel(models, track, resolve))
            }

            DomHelper.drawModels(modelLinks)

            this.getModels(track.models.slice(0), [])
                .then(models => {
                    DomHelper.drawModels(models)
                    modelLinks.map(function (item, i) {
                        var star = track.models.filter(f => f.name == item.name)[0]
                        if (star) {
                            DatabaseHelper.getModel(star.name)
                                .then(answer => {
                                    if (answer && answer.length) {
                                        var model = answer[0];
                                        if (model && model.image && item.tag) {
                                            item.tag.parent().append(`<div><img src="${model.image}" style="width:80px;height:80px;border-radius:50%"></div>`)
                                        }
                                    }
                                })
                        }
                    })
                    resolve("Done")
                })
        })
    }

    loadInfoFromPage() {
        var Key = DomHelper.getKeyOnDetailPage();
        return new Promise(resolve => {
            this.API.Services.Video.get(DatabaseHelper.createParams(1, Key), ret => resolve(ret.rows[0]));
        })
    }

    reportCandidateProgress(app) {
        if (this.isCancelled()) {
            return $('div.boxtitle').empty().append('<div style="width:100%;">Cancelled</div>')
        }

        var count = app.candidates.filter(f => f.selected).length;
        var statusText = `Found ${count} videos`;
        if (app.model && app.model.label) statusText += ` ${app.model.label}`
        var abortLink = `<a style="margin:0px 4px" href="javascript:void(0)" id="abort-find">Stop searching</a>`;
        $(abortLink).click(this.cancelSearch.bind(this))

        $('div.boxtitle').empty().append('<div style="width:100%;"></div>').append(statusText)
    }

    onSearchComplete(app) {
        this.drawCandidates()
        if (this.autoImport()) {
            return this.importCandidates(app.candidates, app.model)
        }
        this.importButtons()
    }

    cancelSearch() {
        this.state = this.states.CANCELLED
        $('.topbanner1').empty()
        $('div.boxtitle').empty().append('<div style="width:100%;">Cancelled</div>')
        this.onSearchComplete(Application.getApplication())
    }

    drawCandidates(candidates) {
        var htm, app = Application.getApplication()
        var selected = candidates || app.candidates.filter(f => f.selected)
        var count = selected.length;
        var photo = !selected[0] ? null : selected[0].Photo
        var deselect = URL => this.deselect(URL, app)
        $('div.video').remove()

        if (candidates) {
            candidates.map(f => {
                f.selected = !0;
                f.Key = DomHelper.getKey(f.Text)
                f.source = f.Photo;
            })
            app.candidates = candidates
        }
        if (app.model && photo) {
            htm = $(`<div class="video" id="add-selected">
                            <a href="javascript:void(0)" title="Add Selected Videos">
                                <img src="${app.model.image || photo}" style="width:100px;height:100px;border-radius:50%" border="0">
                                <div class="title"> Add ${count} Selected Videos ${app.model.name || app.model.label}</div>                           
                            </a>
                        </div>`)
        } else if (photo) {
            htm = $(`<div class="video" id="add-selected">
                        <a href="javascript:void(0)" title="Add Selected Videos"> 
                        <img src="${photo}" style="width:180px;height:auto" border="0">
                            <div class="title"> Add ${count} Selected Videos</div>                           
                        </a>
                    </div>`)
        } else {
            htm = $(`<div class="video" id="add-selected">
                            No matching videos found
                        </div>`)
        }

        $('div.videos').append(htm)
        $('#add-selected').click(() => {
            this.importCandidates(candidates || app.candidates, app.model)
        })

        app.candidates.map(f => {
            var htm = $(`<div class="video" data-url="${f.URL}">
            <a href="javascript:void(0)" title="${f.Text}">
            <div class="id">${f.Key}</div>                            
            <img src="${f.source}" width="147" height="200" border="0">
            <div class="title">${f.Text}</div>
            </a>
            <div><img src="${f.Photo}" style="width:180px;height:auto" border="0"></div>
        </div>`)
            if (f.selected) htm.css({ 'background-color': '#eec', 'height': '350px' })
            else htm.css({ 'background-color': '#eee', 'height': '150px' })
            $('div.videos').append(htm)
        })

        $('*[data-url]').click(function () {
            app = deselect($(this).attr('data-url'))
        })
    }

    deselect(URL, app) {
        app.candidates.map(f => {
            if (f.URL == URL) {
                f.selected = !f.selected;
            }
        })
        Application.save(app)
        this.drawCandidates()
        return app
    }

    drawCandidate(app) {
        Application.save(app)
        this.reportCandidateProgress(app);
        this.drawCandidates()
    }

    isCancelled() {
        if (this.state == this.states.CANCELLED) {
            console.warn('Cancelled');
            return !0
        }
    }

    searchVideoPage(href) {
        if (this.isCancelled()) return;
        var app = Application.getApplication()
        app.candidates = app.candidates || [];

        this.reportCandidateProgress(app);

        DomHelper.createDomFromURL(href || location.href)
            .then(dom => {
                var keysOnPage = DomHelper.getKeysOnPage(dom)
                var searchNext = () => this.searchNextPage(app, dom)
                var filterCandidates = (candidates) => this.filterCandidates(app, keysOnPage, candidates);
                this.UI.matchKeysOnPage(keysOnPage)
                    .then(notList => {
                        if (this.isCancelled()) return;
                        return WebSearcher.SearchAllKeys(notList)
                    })
                    .then(candidates => {
                        if (this.isCancelled()) return;
                        filterCandidates(candidates);
                        this.drawCandidate(app);
                        searchNext()
                    })
            });
    }

    finishSearch(app) {
        $('div.boxtitle').empty().append('<div style="width:100%;">Search complete.</div>')
        this.onSearchComplete(app)
    }

    searchNextPage(app, dom) {
        var next = DomHelper.getNextPage(dom);
        if (next) {
            this.searchVideoPage(next)
            return !0;
        }
        DomHelper.progress(1)
        console.log('Done')
        this.finishSearch(app);
    }

    filterCandidates(app, keysOnPage, candidates) {
        if (candidates && candidates.length) candidates.map(candidate => {
            var foundKey = keysOnPage.filter(keyOnPage => candidate && keyOnPage && keyOnPage.key.toLowerCase() == DomHelper.getKey(candidate.Text))[0]
            if (!foundKey) return;
            return this.processCandidate(app, candidate, foundKey)
        })
    }

    processCandidate(app, candidate, key) {
        if (candidate && candidate.Photo) {
            candidate.Key = key.key;
            candidate.href = key.href;
            candidate.source = key.img;
            candidate.selected = !0;
            app.candidates.push(candidate)
        }
    }

    importCandidates(candidates, model) {
        const buttons = [
            {
                label: 'Cancel Import',
                agent: DomHelper,
                action: 'cancelImport'
            }
        ];
        const boxes = [{
            label: 'Wait for images to load',
            id: 'slowmode',
            when() {
                return VideoHelper.previewImport()
            }
        },
        {
            label: 'Preview while importing',
            id: 'import-preview'
        }]
        this.UI.check(boxes);
        this.UI.draw(buttons);
        this.addCandidates(candidates, model)
    }

    addCandidates(candidates, model) {

        var app = Application.getApplication()
        app.latest = app.latest || []

        if (!candidates.length) {
            app.candidates = []
            Application.save(app);
            DomHelper.cancelImport()
            return
        }

        const candidate = candidates.shift();

        if (!candidate.selected) {
            console.warn('Skipping "%s"', candidate.Text)
            return this.addCandidates(candidates, model)
        }

        return this.addCandidate(candidate, model)
            .then(addedTrack => {

                $('*[data-url]').each(function () {
                    var URL = $(this).attr('data-url')
                    if (candidate.URL == URL) {
                        $(this).css('background-color', 'gray')
                    }
                })

                return this.getOneWho(addedTrack, candidate.Text)
                    .then(() => {
                        app.latest.push(candidate);
                        Application.save(app);
                        return this.addCandidates(candidates, model)
                    })

            });
    }

    getOneWho(track, title) {
        console.log('getOneWho$')
        var videoDetailLink = DomHelper.createSearchLink(title);
        return DomHelper.createDomFromURL(videoDetailLink)
            .then(dom => this.setModelsFromPageInformation(dom, track))
    }

    addCandidate(track, model) {
        let msg = `adding ${track.Text}`;
        const payload = { URL: track.URL };
        if (model) {
            if (model.name) payload.model = model.name;
            msg += ` <b>${model.label || model.name}</b>`
        }
        DomHelper.status(msg);
        return new Promise(resolve => {
            this.API.Services.Video.put(payload, resolve)
        })
    }

    getNextWho() {
        var app = Application.getApplication()
        if (!app.latest.length) {
            return DomHelper.cancelImport()
        }

        var track = app.latest.shift();
        Application.save(app)

        var videoDetailLink = DomHelper.createSearchLink(track.Text);
        return DomHelper.createDomFromURL(videoDetailLink)
        .then(this.setModelsFromPageInformation.bind(this))
        .then(this.getNextWho.bind(this))
        .catch(this.getNextWho.bind(this))
    }

    downloadVideoLinkFromUrl(videoDetailLink) {
        console.log('downloadVideoLinkFromUrl$')
        var _this = this;
        return DomHelper.createDomFromURL(videoDetailLink)
        .then(a => {
            console.log('downloadVideoLinkFromUrl$ [*]');
            return Promise.resolve(a);
        })
        .then(this.setModelsFromPageInformation.bind(this))
        .then(() => {
            if (UserInterfaceHelper.isAuto()) return Promise.resolve(true);
            console.log('Getting next page?')
            return this.downloadVideoPageFromDb ()
        })
    }

    updateStatus(app, videoKey) {

        if (app.latest) {
            var pre = !(app.model && app.model.label) ? "" : `Videos ${app.model.label}: `;
            var msg = `getting ${app.latest.length} latest items`
            if (app.candidates) {
                msg += ` of ${app.candidates.length} candidates`
                DomHelper.progress(app.latest.length / app.candidates.length, pre)
            }
            msg += '. '
            if (app.newest) msg += `${app.newest.length} new models`
            DomHelper.status(msg);
        } else DomHelper.status(`getting data for ${videoKey}`);

    }

    processModelList({ track, modelList, resolve, app, dom }) {
        if (!track) return resolve()

        if (modelList.length) {
            app.fails = 0;
            Application.save(app)

            return this.getModels(modelList, [])
                .then(models => {
                    DomHelper.drawModels(models)
                    return this.setModel(models, track, resolve, dom);
                })
        }

        return new LabelHelper().getTrackTags(track, dom)
            .then(() => {
                app.fails++;
                Application.save(app)
                return resolve(app);
            })
    }



    // get model information from the page 
    setModelsFromPageInformation(dom, addedTrack) {
        return new Promise(resolve => {
            var app = Application.getApplication()
            var videoKey = DomHelper.getKeyOnDetailPage(dom);
            var modelLinks = DomHelper.getModelLinksOnPage(dom);
            var process = ({ track, modelList }) => this.processModelList({ track, modelList, resolve, app, dom });

            console.log('setModelsFromPageInformation$', modelLinks);

            if (!modelLinks.length) {
                var films = DomHelper.getKeysOnPage(dom);
                if (films && films.length) {
                    console.log ({films});
                    const adhocLink = `http://www.javlibrary.com/en/${films[0].href}`; //;
                    return this.downloadVideoLinkFromUrl(adhocLink);
                }
            }

            console.log('No models found..')
            if (!(videoKey && modelLinks.length)) return resolve()

            Application.omit(videoKey);

            this.updateStatus(app, videoKey);
            DomHelper.drawModels(modelLinks)

            return this.getVideoByKey(videoKey, modelLinks, addedTrack)
                .then(process)
        })
    }

    setModel(models, track, fn, dom) {

        if (!models.length) {
            return new LabelHelper().getTrackTags(track, dom)
                .then(() => {
                    return fn(Application.getApplication());
                })
        }

        const model = models.pop();
        const check = track.models.filter(f => f.ID == model.ID)
        const after = () => this.setModel(models, track, fn, dom);

        if (check.length) return after();

        if (model && model.name) {
            console.log("Adding", model.name)
            return this.addModelToVideo(model, track)
                .then(() => {
                    if (model.created) {
                        return new ModelHelper().getSingleModel(model)
                            .then(after)
                    }
                    after()
                })
        }
        return after();
    }

    addModelToVideo(model, track) {
        return new Promise(resolve => {
            return this.API.Services.Model.put({
                ID: model.ID,
                trackFk: track.ID
            }, resolve)
        })
    }

    getModels(items, ret) {

        var elem = ['#video_date', '#video_length', '#video_director', '#video_maker', '#video_label', '#video_review', '#video_genres', '.icn_favstar']
        elem.map(function (f) { $(f).hide() });

        var nameList = items.map(f => f.name);

        return new Promise(resolve => {
            var localList = LocalModel.getModels(nameList)
            if (localList) return processResponse(localList);
            return this.API.Services.Model.put({ nameList }, dbret => {
                var modelList = dbret.rows || [];
                processResponse(modelList)
            })

            function processResponse(modelList) {

                var missingItems = items.filter(f => {
                    return !modelList.filter(z => z.name == f.name)[0]
                })

                modelList.map(f => {
                    var i = items.filter(x => x.name == f.name)[0]
                    ret.push(f)
                    if (i && f.image && i.tag) {
                        i.tag.parent().append(`<div><img src="${f.image}" style="width:80px;height:80px;border-radius:50%"></div>`)
                    }
                });

                return findModels(missingItems)
            }

            function findModels(missingModels) {
                if (!missingModels.length) return resolve(ret);
                var item = missingModels.pop();

                if (!(item.name && item.name.length)) return resolve(ret);

                DatabaseHelper.getModel(item.name)
                    .then(answer => {
                        if (answer && answer.length) {
                            var model = answer[0];
                            if (model && model.image && item.tag) {
                                item.tag.parent().append(`<div><img src="${model.image}" style="width:80px;height:80px;border-radius:50%"></div>`)
                            }
                            return nextModel(model)
                        }
                        DatabaseHelper.createModel(item.name).then(nextModel)
                    })

                function nextModel(model) {
                    ret.push(model)
                    return findModels(missingModels)
                }
            }
        })


    }

    getModelsFromKeys(track) {
        const stars = (track.modelKeys || '').split('[CUT]');
        track.models = stars.map(function (f) {
            var m = f.split('|');
            return {
                name: m[0].trim(),
                ID: m[1],
                image: m[2]
            }
        });
    }

    processTrack(track, key, modelLinks, resolve) {
        let modelList = []
        if (track) {
            Application.omit(key);
            this.getModelsFromKeys(track)
            if (track.tags && track.tags.length) track.Tags = track.tags.join(',')
            modelList = modelLinks.filter(f => !track.models.filter(e => e.name == f.name).length);
        }
        resolve({ track, modelList })
    }

    getVideoByKey(key, modelLinks, defaultTrack) {
        return new Promise(resolve => {
            var app = Application.getApplication()
            const process = (track) => this.processTrack(track, key, modelLinks, resolve);

            if (defaultTrack && defaultTrack.title && defaultTrack.tags) return process(defaultTrack);

            if (app.cachedPage) {
                var rows = app.cachedPage.rows.filter(f => f.title.toLowerCase().indexOf(key.toLowerCase()) >= 0)
                if (rows.length) return process(rows[0]);
            }

            this.API.Services.Video.get(DatabaseHelper.createParams(1, key), ret => process(ret.rows[0]));
        })
    }

    validateVideoRow(video, app) {
        var valid = !0;
        var key = DomHelper.getKey(video.title);
        if (!key) return !1;
        valid = valid && !app.excluded.filter(f => f && (DomHelper.clean(f) == DomHelper.clean(key))).length
        return valid;
    }

    processList(app, recordset) {
        if (!(recordset.rows && recordset.rows.length)) {
            console.warn('processList$.done', app);
            return DomHelper.cancelImport()
        }

        console.warn('processList$', recordset);
        app.cachedPage = recordset;
        Application.save(app);

        var dirtyList = recordset.rows.filter(row => this.validateVideoRow(row, app));



        if (!dirtyList.length) return this.getNextVideoPage(app);

        console.table(dirtyList.map(video => video.title));

        Application.omit(DomHelper.getKey(dirtyList[0].title));

        var videoDetailLink = DomHelper.createSearchLink(dirtyList[0].title);
        console.log({videoDetailLink})
        return this.downloadVideoLinkFromUrl(videoDetailLink);
    }

    getNextVideoPage(app) {
        app.page++;
        app.cachedPage = null;
        Application.save(app)
        if (UserInterfaceHelper.isAuto()) return Promise.resolve(true);
        console.log('getNextVideoPage$', app.page)
        return this.downloadVideoPageFromDb();
    }

    downloadVideoPageFromDb() {
        var app = Application.getApplication()
        var process = recordset => this.processList(app, recordset);

        console.log("downloadVideoPageFromDb$ page: %d, fails: %d", app.page, app.fails)
        DomHelper.status(`loading page ${app.page} data`);

        if (app.fails > this.maximumFails) return DomHelper.cancelImport();
        if (app.cachedPage) {
            console.warn('cached page', app.cachedPage)
            return process(app.cachedPage);
        }

        return this.API.Services.Video.get(DatabaseHelper.listParams(app.page), process);
    }
}

class ModelHelper {
    constructor() {
        this.API = new AppResource()
    }

    start() {
        Application.renew()
        this.downloadModelPageFromDb()
    }

    onModelRelatedItemsLoaded(modelRef) {
        var app = Application.getApplication()

        if (!(modelRef.titleKeys && modelRef.titleKeys.length)) {
            console.warn('no tracks found for', modelRef)
            return Promise.resolve(modelRef)
        }

        app.model = modelRef;
        Application.save(app)

        return DomHelper.createDomFromURL(app.model.titleKeys[0].href)
            .then(this.getModelPageInformation.bind(this))
    }

    downloadModelPageFromDb() {
        return this.getModelList()
            .then(this.getModelByID.bind(this))
            .then(this.onModelRelatedItemsLoaded.bind(this))
    }

    getModelByID(star) {
        var modelRef = {
            name: star.name,
            ID: star.ID,
            titleKeys: []
        }
        return new Promise(resolve => {
            this.API.Services.Model.get({ id: star.ID }, function (s) {
                modelRef.titleKeys = s.related.map(function (f) {
                    return { //  list of title_keys from model.related
                        key: DomHelper.getKey(f.title),
                        href: DomHelper.createSearchLink(f.title),
                        models: f.modelKeys.split('[CUT]')
                    }
                }).filter(function (e) { return e.key })
                return resolve(modelRef)
            })
        })

    }

    validateModelRow(model, app) {
        var valid = !model.image
        valid = valid && !app.excluded.filter(function (f) { return f == model.ID }).length
        return valid;
    }

    processList(app, recordset, resolution) {

        if (!recordset.data.length) {
            return DomHelper.cancelImport()
        }
        app.cachedPage = recordset;
        Application.save(app);

        var dirtyList = recordset.data.filter(row => this.validateModelRow(row, app));
        if (!dirtyList.length) return this.getNextModelPage(app);

        console.table(dirtyList.map(model => model.name));

        resolution(dirtyList[0])
    }

    getNextModelPage(app) {
        app.page++;
        app.cachedPage = null;
        Application.save(app)
        return this.downloadModelPageFromDb();
    }

    getModelList() {
        var app = Application.getApplication();

        console.log("page %d fails %d", app.page, app.fails)
        DomHelper.status(`loading model page ${app.page}`);

        if (app.fails > 50) {
            return DomHelper.cancelImport()
        }

        return new Promise(resolve => {
            var process = recordset => this.processList(app, recordset, resolve);
            if (app.cachedPage) return process(app.cachedPage);
            return this.API.Services.Model.get(DatabaseHelper.listParams(app.page), process);
        })
    }

    setModelImage(model, image, resolution) {
        console.log('setModelImage$', image)
        var payload = {
            ID: model.ID,
            image
        }
        Application.omit(model.ID)
        LocalModel.setModelImage(model, image)
        return this.API.Services.Model.put(payload, resolution)
    }

    getSingleModel(model) {
        var app = Application.getApplication()
        return new Promise(resolve => {
            this.getModelByID(model)
                .then(modelRef => {
                    app.model = modelRef;
                    Application.save(app);
                    return DomHelper.createDomFromURL(app.model.titleKeys[0].href, true)
                })
                .then(dom => {
                    return this.getModelPageInformation(dom)
                        .then(resolve)
                })
        })
    }

    processSingleModel(modelLinks, resolution) {
        return DomHelper.createDomFromURL($(modelLinks[0].tag).attr('href'), true)
            .then(dom => {
                return this.findModelPhoto(dom, resolution)
            })
    }

    processMultiModel(modelLinks, persistedModel, resolution) {

        var model = modelLinks.filter(function (f) {
            return f.name == persistedModel.name || f.reverse == persistedModel.name;
        })[0]

        if (!model) return resolution()

        console.log('processMultiModel$', model)
        var href = $(model.tag).attr('href')

        return DomHelper.createDomFromURL(href, true)
            .then(dom => {
                this.buildModelKeyIndex(dom, resolution)
            })
    }

    findSingleModelOnDetailPage(dom, resolution) {
        console.log('findSingleModelOnDetailPage$')
        var app = Application.getApplication()
        var models = DomHelper.getModelLinksOnPage(dom);


        if (!models.length) {
            console.warn('no model links found for', app.model)
            return DomHelper.getDetailAddressFromModelList(dom)
                .then(answer => {
                    console.log('findSingleModelOnDetailPage.getDetailAddressFromModelList')
                    return this.findSingleModelOnDetailPage(answer, resolution)
                })
                .catch(resolution)
        }

        if (models.length == 1) {
            var src = app.model.titleKeys[0].image
            app.fails = 0
            Application.save(app)
            console.log('calling setModelImage...')
            return this.setModelImage(app.model, src, resolution)
        }

        app.fails++
        Application.save(app)
        return this.leafToNextDetailPage(resolution)
    }

    findModelPhoto(dom, resolution) {

        var _this = this;
        var parent = DomHelper.createParent(dom, 'div.video a')
        var app = Application.getApplication()
        var found = !1;

        // get videos from current model list page
        parent.each(function () {
            var id = $(this).children('div.id')
            var img = $(this).children('img')
            if (id && id.length) {
                var text = $(id[0]).text();
                if (app.model.titleKeys.filter(function (f) {
                    return DomHelper.clean(f.key) == DomHelper.clean(text)
                }).length) {
                    $(this).css({ color: 'red', 'font-weight': '900' })
                    if (img && img.length) {
                        var src = $(img[0]).attr('src');
                        console.log('eureka!', src)
                        found = !0;
                        _this.setModelImage(app.model, src, resolution)
                    }
                } else $(this).parent().hide()
            }
        })

        if (!found) {
            var thisPage = DomHelper.getNextPage(dom);

            if (!thisPage) {
                Application.omit(app.model.ID)
                return resolution(app.model)
            }

            return DomHelper.createDomFromURL(thisPage)
                .then(dom => {
                    this.findModelPhoto(dom, resolution)
                })
        }

    }

    leafToNextDetailPage(resolution) {

        console.log('leafToNextDetailPage$')
        var app = Application.getApplication()
        if (!(app.model.films && app.model.films.length)) {
            return resolution()
        }

        var first = app.model.films.pop();

        var find = DomHelper.searchLink(first.key);
        app.model.isReady = !0;
        app.model.titleKeys = [{
            key: first.key,
            href: find,
            image: first.img,
        }]
        Application.save(app)
        return DomHelper.createDomFromURL(find, true)
            .then(dom => {
                this.findSingleModelOnDetailPage(dom, resolution);
            })
    }

    buildModelKeyIndex(dom, resolution) {
        var app = Application.getApplication()
        if (!app.model.films) app.model.films = []

        var films = DomHelper.getKeysOnPage(dom);
        if (!(films && films.length)) {
            return console.warn("no videos found!", app)
        }

        films.map(function (f) { app.model.films.push(f) })
        Application.save(app)
        var next = DomHelper.getNextPage(dom);
        if (next) {
            return DomHelper.createDomFromURL(next).then(dom => {
                this.buildModelKeyIndex(dom, resolution);
            });
        }
        return this.leafToNextDetailPage(resolution)
    }

    lookupModelsOnDetailPage(persistedModel, modelLinks, resolution) {
        DomHelper.drawModels(modelLinks)
        if (modelLinks.length == 1) {
            return this.processSingleModel(modelLinks, resolution);
        }
        return this.processMultiModel(modelLinks, persistedModel, resolution);
    }

    getModelPageInformation(dom) {
        return new Promise((resolve) => {
            var app = Application.getApplication()
            var modelLinks = DomHelper.getModelLinksOnPage(dom);
            if (app.model && modelLinks.length) {
                DomHelper.status(`getting model data for <b>${app.model.name}</b> from ${modelLinks.map(f => f.name).join(',')}`);
                return this.lookupModelsOnDetailPage(app.model, modelLinks, resolve)
            }
            resolve()
        })
    }

    getModelByID(star) {

        return new Promise(resolve => {

            var modelRef = {
                name: star.name,
                ID: star.ID,
                titleKeys: null
            }

            this.API.Services.Model.get({ id: star.ID }, function (s) {

                if (!(s && s.related)) return resolve(modelRef)
                modelRef.titleKeys = s.related.map(function (f) {
                    return { //  list of title_keys from model.related
                        key: DomHelper.getKey(f.title),
                        href: DomHelper.createSearchLink(f.title),
                        models: !f.modelKeys ? null : f.modelKeys.split('[CUT]')
                    }
                }).filter(function (e) { return e.key })

                return resolve(modelRef)
            })
        })
    }
}

class LabelHelper {
    constructor() {
        this.API = new AppResource()
    }

    getTrackTags(track, dom) {
        console.log('getTrackTags', track.title);
        if (dom) return this.getPageInformation(dom, track)
        var videoDetailLink = DomHelper.createSearchLink(track.title);
        return DomHelper.createDomFromURL(videoDetailLink)
            .then(dom => this.getPageInformation(dom, track))
    }

    processTagInfo(app, track, tagLinks, resolve) {

        if (track.Tags) {
            const existings = track.Tags.split(',').map(f => f.trim())
            tagLinks = tagLinks.filter(e => !existings.filter(f => f == e).length)

            if (!tagLinks.length) {
                app.fails++
                Application.save(app)
                return resolve();
            }

            tagLinks.map(f => existings.push(f));
            tagLinks = existings;
        }

        if (!tagLinks.length) return resolve();
        DomHelper.status(`Adding tags ${tagLinks.join(', ')} to ${track.title}`)
        console.log({ tagLinks })
        return this.API.Services.Tag.put({
            ID: track.ID,
            tags: tagLinks
        }, (answer) => {
            app.fails = 0
            Application.save(app)
            resolve(answer);
        })
    }

    getPageInformation(dom, currentTrack) {
        var app = Application.getApplication();
        var Key = DomHelper.getKeyOnDetailPage(dom),
            tagLinks = DomHelper.getTagsOnPage(dom);

        return new Promise(resolve => {
            var process = (track) => this.processTagInfo(app, track, tagLinks, resolve);
            if (!(Key && tagLinks.length)) return resolve()
            DomHelper.status(`getting tags for ${currentTrack.title}`);
            Application.omit(Key)
            return process(currentTrack);
        });
    };
}

class DomHelper {
    static getDetailAddressFromModelList(dom) {
        return new Promise((resolve, reject) => {
            var keysOnPage = DomHelper.getKeysOnPage(dom);
            var boxtitle = DomHelper.createParent(dom, 'div.boxtitle')
            var specific = /"([^"]*?)" ID Search Result/.exec(boxtitle.text())
            if (specific) {
                if (keysOnPage && keysOnPage.length) {
                    DomHelper.status(`Found ${keysOnPage[0].key}. opening...`)
                    Application.omit(specific[1]) // only try once
                    return DomHelper.createDomFromURL(keysOnPage[0].href).then(resolve);
                }
            }
            console.error("No id found")
            reject()
        })
    }

    static getTagsOnPage(dom) {
        var parent = DomHelper.createParent(dom, 'span.genre a')
        var keys = []
        parent.each(function () {
            keys.push($(this).text().toLowerCase())
        })
        return keys;
    }

    static getModelOnDetailPagebyName() {
        return new Promise(resolve => {
            var label, model, text = $('div.boxtitle').text();
            var parse = /Videos\s*(\w+)\s*([\s\S]+)/.exec(text);

            if (parse) {
                label = parse[1] + ' ' + parse[2]
                if (parse[1] == "starring") {
                    var name = parse[2];

                    return DatabaseHelper.getModel(name)
                        .then(answer => {
                            if (answer && answer.length) {
                                model = answer[0];
                                model.label = label;
                            }
                            resolve(model)
                        })
                }
            }

            resolve({ label })
        })
    }

    static getNextPage(dom) {
        var parent = DomHelper.createParent(dom, 'a.page')
        var lastPage, thisPage = 1;
        var b = [], m = /page=(\d+)/.exec(location.href);
        if (m) {
            thisPage = +m[1]
        }

        if (dom) {
            thisPage = +dom.find('span.page.current').text()
            lastPage = dom.find('a.page.last')
            if (lastPage.length) {
                var href = lastPage.attr('href'),
                    m = /page=(\d+)/.exec(href);
                if (m) {
                    lastPage = +m[1]
                    document.title = `Page ${thisPage} of ${lastPage}`
                    DomHelper.progress(thisPage / lastPage)
                }
            }
        }

        parent.each(function () {
            if (thisPage < +$(this).text()) {
                b.push($(this).attr('href'))
            }
        })
        return b[0];
    }

    static drawModels(modelLinks) {
        if (!VideoHelper.previewImport()) return;
        var pa = $("div.menul1 ul")[1]
        if (pa) {
            $(pa).empty()
            modelLinks.map(f => {
                var local = LocalModel.getModel(f.name)
                if (local && local.image) f.image = local.image;
                if (f.image) {
                    var css = {
                        float: "left",
                        width: "30px",
                        height: "30px",
                        "border-radius": "50%",
                        margin: "2px 6px"
                    };
                    var img = $(`<img src="${f.image}">`)
                    img.css(css)
                    var li = $(`<li></li>`)
                    li.css({ height: '36px', 'background-color': '#333' }).append(img, `<a style="font-size:.7em;border:none" href="#">${f.name}</a>`)
                    return $(pa).append(li)
                }
                $(pa).append(`<li><a href="javascript:void(0)" id="label_imp">${f.name}</a></li>`)
            })
        }
    }

    static progress(percent) {
        var prefix = ``;
        var label = Math.ceil(percent * 100)
        var value = Math.floor(25 * percent)
        for (var j = [], i = 0; ++i < value; j.push('|'));
        for (var z = [], i = value; ++i < 25; z.push('|'));
        var black = $('<span style="color:red">' + j.join('') + '</span>')
        var gray = $('<span style="color:gray">' + z.join('') + '</span>')
        $('.languagemenu').empty().append(black, gray);
        document.title = `${prefix}${label}%`
    }

    static getModelLinksOnPage(dom) {

        var parent = DomHelper.createParent(dom, '#video_cast span.star a')
        var stars = []
        parent.each(function () {
            stars.push({
                name: $(this).text(),
                tag: $(this),
                reverse: DomHelper.reverse($(this).text())
            });
        })
        return stars;
    }

    static getKeyOnDetailPage(dom) {
        var parent = DomHelper.createParent(dom, '#video_id td.text')
        var re, Key;
        parent.each(function () {
            if (re = DomHelper.getKey($(this).html())) {
                Key = re
            }
        })
        return Key;
    }

    static createDomFromURL(href, slow, noretry) {
        console.log({ href })
        return new Promise(resolve => {
            $.get(href, body => {
                if (!VideoHelper.previewImport()) return resolve($(body))
                DomHelper.renderImage($(body), slow).then(resolve);
            }).fail(error => {
                console.log('An error has occurred', error);
                if (noretry) return "Not trying again"
                console.log('Trying again in 30 seconds');
                setTimeout(() => {
                    console.log('Trying again...');
                    DomHelper.createDomFromURL(href, slow, true).then(resolve)
                }, 29999)
            })
        })
    }

    static renderImage(dom, slowMode) {

        return new Promise(resolve => {
            if (!$('div.videos').length) return resolve(dom);
            var img, slow = slowMode || !!$('#slowmode:checked').length

            if (img = dom.find('#video_jacket img')) {
                var src = img.attr('src');
                const modelLinks = DomHelper.getModelLinksOnPage(dom);
                if (modelLinks && modelLinks.length) DomHelper.drawModels(modelLinks);
                if (src) {
                    if (slow) return DomHelper.imagePromise(src).then(() => draw(src))
                    return draw(src)
                } else resolve(dom)
            } else resolve(dom)

            function draw(src) {
                if ($('.rendered-image').length) $('.rendered-image').attr('src', src);
                else $('div.videos').empty().append(`<img class="rendered-image" src="${src}">`)
                resolve(dom)
            }
        })
    }

    static imagePromise(src) {
        return new Promise(resolve => {
            var im = new Image;
            im.onload = resolve;
            im.onerror = resolve;
            im.src = src;
        })
    }

    static getKey(title) {
        var re
        if (re = /(\w+\-\d+)/.exec(title)) {
            return re[1].toLowerCase()
        }
    }

    static createSearchLink(title) {
        var key = DomHelper.getKey(title)
        if (key) {
            return DomHelper.searchLink(key);
        }
    }

    static searchLink(Key) {
        return `http://www.javlibrary.com/en/vl_searchbyid.php?keyword=${Key}`;
    }

    static cancelImport() {
        new Application().reset()
        location.reload()
    }

    static status(text) {
        var app = new Application().read()
        var statusText = !(app.model && app.model.label)
            ? `<div>Page ${app.page}, failures: ${app.fails}<br/><small>${text}</small></div>`
            : `<div>Videos ${app.model.label}<br/><small>${text}</small></div>`;

        $('.topbanner1').empty().append(statusText)
    }

    static createParent(dom, selector) {
        return !dom ? $(selector) : dom.find(selector)
    }

    static getKeysOnPage(dom) {

        var keys = []
        var parent = DomHelper.createParent(dom, 'div.video a')
        parent.each(function () {
            var id = $(this).children('div.id')
            var img = $(this).children('img')
            if (id && id.length) {
                var text = $(id[0]).text();
                //     
                var obj = {
                    key: text,
                    tag: $(this),
                    host: $(this).parent(),
                    href: $(this).attr('href'),
                    img: !(img && img.length) ? null : $(img[0]).attr('src')
                }
                keys.push(obj)
                $(this).css({ color: 'gray' })
            }
        })
        return keys;
    }

    static javdoe(Key) {
        return `<a href="${DomHelper.javlink(Key)}" target="_blank">${Key}</a>`;
    }

    static cleanKey(Key) {
        let re = null;
        if (re = /(\w+\-\d+)/.exec(Key)) {
            return re[1]
        }
        return Key
    }

    static javlink(key) {
        var Key = DomHelper.cleanKey(key.toLowerCase())
        return `https://javdoe.tv/search/movie/${Key}.html`;
    }

    static javfinderlink(key) {
        var Key = DomHelper.cleanKey(key.toLowerCase())
        return `https://javfinder.la/search/movie/${Key}.html`
    }

    static clean(a) {
        if (a && a.replace) return a.replace('-', '').toLowerCase();
        return ""
    }

    static reverse(f) {
        if (f.indexOf(' ') < 0) return f;
        return f.split(' ').reverse().join(' ')
    }
}

class WebSearcher {
    static findAnswer(key, answer) {
        return answer.items.filter(f => f.Text.toLowerCase().indexOf(key.toLowerCase()) >= 0)[0]
    }

    static checkAnswer(key, answer) {
        if (answer.items && answer.items.length && WebSearcher.findAnswer(key, answer)) {
            return WebSearcher.findAnswer(key, answer)
        }
    }

    static searchByKey(Key) {
        const api = new AppResource()
        return new Promise(resolve => {

            const address = DomHelper.javlink(Key)
            $.get(address, res => {
                console.log({ res })
                resolve()
            })
            return;


            api.Services.Parser.put({ URL: DomHelper.javlink(Key) }, (answer) => {
                console.log({ answer })
                if (parseAnswer(answer)) return
                resolve()
                // return api.Services.Parser.put({ URL: DomHelper.javfinderlink(Key) }, answer => {
                //     if (parseAnswer(answer)) return
                //     resolve()
                // })
            })

            function parseAnswer(answer) {
                let response = null;
                if (response = WebSearcher.checkAnswer(Key, answer)) {
                    resolve(response)
                    return !0
                }
                return !1;
            }
        });
    }

    static SearchAllKeys(keys) {
        return Promise.all(keys.map(key => WebSearcher.searchByKey(key)))
    }
}

class DatabaseHelper {

    static listParams(page) {
        return {
            page: page,
            sort: "ID",
            desc: 1
        };
    }

    static createParams(page, param) {
        return {
            page: page,
            sort: "ID",
            mask: "title/" + param,
            desc: 1,
            single: 1
        };
    }

    static addItemFromKey(Link) {
        return WebSearcher.searchByKey(Link.key)
            .then(candidate => {
                if (!candidate) {
                    return Link.host.empty().append('<i>not found</i>')
                }
                DatabaseHelper.addSingleCandidate(candidate)
            })
    }

    static addSingleCandidate(candidate) {
        if (!candidate) return;
        var helper = new VideoHelper()
        var app = Application.getApplication()
        app.latest = app.latest || []
        helper.addCandidate(candidate)
            .then(ret => {
                app.latest.push(candidate);
                new Application().write(app);
                helper.whois()
            })
    }

    static getModel(param) {
        console.log('...getting model "%s"', param)
        var localModel = LocalModel.getModel(param)
        if (localModel) return Promise.resolve(localModel)
        return new Promise(resolve => {
            var api = new AppResource()
            api.Services.Model.get({ mask: `name/${param}`, page: 1 }, function (answer) {
                resolve(!(answer.data && answer.data.length) ? [] : answer.data.filter(f => f.name.toLowerCase() == param.toLowerCase()))
            })
        })
    }

    static createModel(name, fn) {
        console.log('...creating model "%s"', name)
        return new Promise(resolve => {
            var api = new AppResource()
            api.Services.Model.get({ name }, function (model) {
                model.created = !0;
                LocalModel.add(model)
                resolve(model);
            })
        })
    }

    static likeVideo(track) {
        const api = new AppResource()
        const payload = {
            ID: track.ID,
            src: track.src,
            URL: track.URL,
            favorite: track.favorite ? 0 : 1
        };
        return new Promise(resolve => api.Services.Video.post(payload, resolve))
    }
}

class UserInterfaceHelper {

    constructor() {
        this.API = new AppResource()
    }

    static isAuto() {
        return location.href.indexOf('#auto') > 0;
    }

    checkHref() {
        var re = /keys\/([^\/]+)/.exec(location.href)
        if (re) {
            console.log(re[1])
            return re[1]
        }
    }

    filterCandidates(app, keyList, candidates) {
        if (candidates && candidates.length) candidates.map(candidate => {
            var foundKey = keyList.filter(key => candidate && key && key.toLowerCase() == DomHelper.getKey(candidate.Text))[0]
            if (!foundKey) return;
            return this.processCandidate(app, candidate, foundKey)
        })
    }

    buttons(keys) {
        return [
            {
                label: 'Video Replace',
                agent: new VideoHelper(),
                action: 'start'
            },
            {
                label: 'Model Lookup',
                agent: new ModelHelper(),
                action: 'start'
            },
            {
                label: 'Video Search',
                agent: new VideoHelper(),
                action: 'search',
                when() {
                    return DomHelper.getKeysOnPage().length
                }
            },
            {
                label: 'Video Import',
                agent: new VideoHelper(),
                action: 'adapt'
            },
            {
                label: 'Check Video',
                agent: new VideoHelper(),
                action: 'check',
                when() {
                    return DomHelper.getKeyOnDetailPage();
                }
            },
            {

                label: 'test',
                agent: new UserInterfaceHelper(),
                action: 'testModelDownload',
                when() { return !0; }
            },
            {
                label: 'Search Javdoe',
                agent: new VideoHelper(),
                action: 'javdoe',
                when() {
                    if (keys && keys.length) {
                        this.label = `Search Javdoe (${keys.length})`
                    }
                    return keys && keys.length;
                }
            },
            {
                label: 'Search Javdoe',
                agent: new VideoHelper(),
                action: 'javauto',
                when() {
                    if (keys && keys.length) {
                        this.label = `Auto-add (${keys.length}) items`
                    }
                    return keys && keys.length;
                }
            }
        ];
    }

    checkboxes() {
        return [{
            label: 'Wait for images to load',
            id: 'slowmode'
        }]
    }

    start() {
        if (!this.drawMenu()) return;
        this.precheckLinks()
            .then(() => {
                this.resetSideMenu();
                this.populatePage();
                this.checkExisting();
                $('.videothumblist').css({ overflow: 'auto' });
            });

    }

    checkExisting() {

        var list;
        var app = Application.getApplication();
        var help = new VideoHelper();
        app.candidates = []
        if (list = this.checkHref()) {
            list = list.split(',');
            WebSearcher.SearchAllKeys(list)
                .then(candidates => {
                    console.log(candidates)
                    var fresh = candidates.filter(candidate => {
                        var ok = candidate &&
                            candidate.Text &&
                            list.filter(word => {
                                return word == DomHelper.getKey(candidate.Text)
                            }).length;
                        if (ok) console.log(candidate.Text)
                        return ok
                    });

                    return this.API.Services.Video.put({ keyList: list }, records => {
                        var existingTracks = records.rows;

                        fresh.map(candidate => candidate.key = DomHelper.getKey(candidate.Text))

                        if (existingTracks && existingTracks.length) {
                            fresh = fresh.filter(track => {
                                return !existingTracks.filter(existing => existing.title.toLowerCase().indexOf(track.key.toLowerCase()) >= 0).length
                            })
                        }

                        if (!fresh.length) return console.warn("No new tracks in ", list)

                        console.log(fresh)
                        return LocalModel.load()
                            .then(answer => {
                                help.drawCandidates(fresh)
                            })
                    })


                })
            return;
        }
    }

    getParent() {
        return $('.sploosh-parent')
    }

    draw(buttons) {
        $(this.getParent()).empty()
        buttons.map(this.addButton.bind(this));
    }

    check(boxes) {
        var add = box => this.addCheckbox(box, boxes);
        var items = boxes.map(add);
        $('.displaymode').empty().append(items);
    }

    resetSideMenu(NotOnPage) {
        console.log({ NotOnPage })
        KeysNotOnPage = NotOnPage;
        this.draw(this.buttons(KeysNotOnPage))
    }

    drawMenu() {
        var parent = $('div.menul1')[0]
        if (!parent) {
            console.warn("No menu area. Aborting...");
            return !1
        }
        var sploosh = $('<ul class="sploosh-parent"></ul>')
        $(parent).append('<div class="category">Actions</div>', sploosh)
        return !0;
    }

    addCheckbox(checkbox, boxes) {
        //      if (checkbox.when && !checkbox.when()) return;
        const checked = $(`#${checkbox.id}:checked`).length;
        const menu = $(`<label><input type="checkbox" id="${checkbox.id}"/>${checkbox.label}</label>`);
        //    const onclick = () => this.check(boxes);
        if (checked) menu.prop('checked', true);
        //  menu.click(onclick);
        return menu;
    }

    addButton(button) {
        console.log(button.label)
        if (button.when && !button.when()) return console.warn('Not shown!');
        var btn = $(`<li><a href="javascript:void(0)" id="check_imp">${button.label}</a></li>`)
        btn.click(() => { button.agent[button.action](); btn.text('Running...') })
        $(this.getParent()).append(btn)
    }

    populatePage() {
        var links = DomHelper.getKeysOnPage();
        if (!(links && links.length)) return UserInterfaceHelper.renderPlayControls();
        links.map(f => {
            var d = $(`<div>${f.key}</div>`);
            d.click(() => {
                DatabaseHelper.addItemFromKey(f)
            }).css({ cursor: 'default' });
            f.host.append(d);
        });
        this.matchKeysOnPage(links);
    }

    static launchVideo(video) {
        window.open(video.src, video.URL,
            `width=${video.width},height=${video.height},toolbar=0,location=0`);
    }

    testModelDownload() {

        const address = ['chn-001', 'abp-024']
        const _this = new VideoHelper();
        return LocalModel.load().
            then(() => UserInterfaceHelper.getAutoKeys(address))
            .then(rows => _this.processList(Application.getApplication(), rows))
            .then((output) => {
                console.log({output})
                return Promise.resolve(true);
            })

    }

    autoLoad(address, dmmhref) {
        const _this = new VideoHelper();
        return LocalModel.load().
            then(() => UserInterfaceHelper.getAutoKeys(address.split('/')))
            .then(rows => _this.processList(Application.getApplication(), rows))
            .then(() => {
                if (dmmhref) {
                    const href = atob(dmmhref);
                    return location.href = `https://www.dmm.co.jp/digital/videoa/${href}#auto`;
                }
                return Promise.resolve(true);
            });
    }

    precheckLinks() {
        if (UserInterfaceHelper.isAuto()) {
            const tmp = location.href.split('#auto');
            const address = tmp[1];
            const dmmhref = tmp[2];
            if (address && address.length) {
                return this.autoLoad(address, dmmhref);
            }
        } else if (location.href.indexOf('#find') > 0) {
            const tmp = location.href.split('#find');
            const address = tmp[1];
            return this.autoLoad(address)
                .then(() => self.close());
        }
        return Promise.resolve(true)
    }

    matchKeysOnPage(keysOnPage) {
        var notList = [], newList = []
        var keyList = keysOnPage.map(f => f.key);
        return new Promise((resolve) => {
            this.API.Services.Video.put({ keyList }, records => {
                var existingTracks = records.rows;
                if (existingTracks && existingTracks.length) {
                    existingTracks.map(existingVideo => {

                        keysOnPage.map(item => {
                            if (existingVideo.title.toLowerCase().indexOf(item.key.toLowerCase()) >= 0) {
                                newList.push(item.key)
                                var image = $('<div><img src="' + existingVideo.image + '" style="width:100px;height:auto"/></div>')
                                image.click(() => {
                                    UserInterfaceHelper.launchVideo(existingVideo)
                                })
                                item.host.show().css({ height: '350px' }).append(image)
                                $(item.tag).css({ color: 'black', 'font-weight': existingVideo.favorite ? '900' : '400' })
                                item.host.find('img').css({ opacity: 1 })
                            } else {
                                var e = notList.filter(f => f == item.key)[0]
                                var h = newList.filter(f => f == item.key)[0]
                                if (e || h) return;
                                notList.push(item.key)
                                item.host.find('img').css({ opacity: .6 })
                            }
                        })

                    })

                    const NotOnPage = []
                    keysOnPage.map(item => {
                        const f = existingTracks.filter(vid => vid.title.toLowerCase().indexOf(item.key.toLowerCase()) > 0)[0];
                        if (!f) NotOnPage.push(item.key);
                    })
                    console.log({ NotOnPage })
                    UserInterfaceHelper.processNotFound(NotOnPage)
                } else {
                    notList = keyList;
                    UserInterfaceHelper.processNotFound(keyList)
                }
                notList = notList.filter(f => !newList.filter(g => g == f).length)
                resolve(notList)
            })
        })
    }

    static getAutoKeys(keyList) {
        const _this = new VideoHelper();
        return new Promise(resolve => {
            _this.API.Services.Video.put({ keyList }, resolve);
        })
    }

    static processNotFound(keyList) {
        const list = new ModelList()
        KeysNotOnPage = keyList;
        if (UserInterfaceHelper.isAuto()) {
            return new VideoHelper().javauto();
        }
        new UserInterfaceHelper().resetSideMenu(keyList)
    }

    static renderPlayControls() {
        var _this = new VideoHelper();
        var app = Application.getApplication();
        var Key = DomHelper.getKeyOnDetailPage();
        var modelList = DomHelper.getModelLinksOnPage();
        var modelCount = 0;
        if (!Key) return;
        new VideoHelper().getVideoByKey(Key, [])
            .then(({ track, models }) => {


                if (!(track && track.src)) return;

                if (track.models && modelList) {
                    modelCount = track.models.filter(m => m.ID).length;
                    modelList.map(item => {
                        var model = track.models.filter(f => f.name == item.name)[0]
                        if (!model) return;
                        item.tag.parent().append(`<div><img src="${model.image}" style="width:80px;height:80px;border-radius:50%"></div>`);
                    });
                }


                console.log('renderPlayControls$', track, modelList)
                var btn = $(`<button type="button" class="smallbutton">Play this video!</button>`);
                var add = $(`<button type="button" class="smallbutton"></button>`);
                btn.click(playVideo);

                $("#video_jacket").click(playVideo)
                add.click(function () {
                    DatabaseHelper.likeVideo(track)
                        .then(UserInterfaceHelper.renderPlayControls)
                }).html(track.favorite ? 'Remove from favorites' : 'Add to favorites')

                if (modelList.length > modelCount) {
                    LocalModel.load()
                        .then(() => new Promise(resolve => {
                            _this.processModelList({ track, modelList, resolve, app, dom: $(document.body) });
                        }))
                        .then(answer => {
                            DomHelper.status(`added models to ${track.title}`)
                        })
                }

                return $('#video_favorite_edit').empty()
                    .append(btn, add);

                function playVideo() {
                    return UserInterfaceHelper.launchVideo(track)
                }
            })
    }

    static open() {
        new UserInterfaceHelper().start()
    }
}

class AppResource {

    constructor() {
        this.endpoints = {
            "ApiHost": ""
        }

        this.Services = {
            Parser: this.create(this.endpoints.ApiHost + "/parser"),
            Model: this.create(this.endpoints.ApiHost + "/model"),
            Video: this.create(this.endpoints.ApiHost + "/video"),
            Tag: this.create(this.endpoints.ApiHost + "/tag"),
        }
    }

    create(address) {

        return {
            get: (params, fn) => {
                $.get(address, params, fn)
            },
            post: (body, fn) => {
                return $.ajax({
                    type: 'POST',
                    url: address,
                    contentType: "application/json",
                    dataType: 'text',
                    success: fn,
                    data: JSON.stringify(body),
                    error: e => {
                        alert(e.message);
                    }
                });
            },
            put: (body, fn) => {
                return $.post(address, body, fn)
            }
        }
    }
}

class JAVLibraryReader {
    static version() { return "2.248"; }

    static start() {
        console.log(`JAVLibrary Reader v${JAVLibraryReader.version()}. Session ${Session.Key}`)
        console.table(Application.getApplication())
        var jq = document.createElement('script');
        jq.onload = JAVLibraryReader.init;
        jq.src = "https://code.jquery.com/jquery-2.1.1.min.js";
        document.querySelector('head').appendChild(jq)
    }

    static init() {
        UserInterfaceHelper.open()
    }
}
var KeysNotOnPage = null;
const Session = { Key: btoa(Math.random() * 1000) };
const LocalModel = new ModelList();
JAVLibraryReader.start();
