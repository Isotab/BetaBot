// ==UserScript==
// @name         Betabot
// @namespace    audogfuolhfiajhf656+
// @version      1.2.16
// @description  Avabur Beta Bot
// @author       Batosi
// @match        https://beta.avabur.com/game*
// @require      https://cdn.jsdelivr.net/npm/lodash@4.17.11/lodash.min.js
// @downloadURL  https://github.com/Isotab/BetaBot/raw/main/BetaBot.user.js
// @updateURL    https://github.com/Isotab/BetaBot/raw/main/BetaBot.user.js
// @grant        none
// ==/UserScript==


/*
    TODO:
    * Add screen for crafting item sets
    * Polish up list for gem spawning (WIP)
    * Write mass wire based upon the pattern ${settings.alt_basename}${romanize(x)}
    * Add some in game information on what each setting does
    *
*/

(async function($) {

    let vars = {
        username: $("#username").text().toLowerCase().trim(),
        actionPending: false,
        actionCount: 0,
        maxActionCount: 10,
        lastRefreshAttempt: 0,
        isAlt: false,
        checkingChannel: true,
        checkingEventChannel: true,
        debug: true,
        channelId: 0,
        eventChannelID: 0,
        lastAction: null,
        canSpawnGem: true,
    }

    let logs = []

    let tags = [
        'All',
        'Alts',
        'Fishers',
        'Woodcutters',
        'Miners',
        'Stonecutters',
        'TSers'
    ]

    let settings = {
        default: {
            control: {
                replenish: false,
                quest: false,
                construction: false,
                construction_type: 'quickest',
                construction_cleanup: false,
                harvestron: false,
                harvestron_type: 'round_robin',
                crafting: false,
                carving: false,
                mob_control: false,
                mob_control_locket: false,
                upgrade_tool_level: false,
                upgrade_tool_tier: false,
                max_level: '150000',
                spawngems: true,
            },
            event: {
                join: false,
                base_action: 'carving',
                fallback_action: 'battle',
                max_carving: '2000',
                join_time: '15',
                switch_to_battle: false,
            },
            trainingcenter: {
                max_gold: '5000000000000',
                max_plat: '5000000000',
                percent_ms: '0.05',
                percent_chc: '0.2',
                percent_chd: '0.2',
                percent_tou: '0.2',
                percent_cad: '0.3',
                percent_hb: '0.05',
            },
            setting: {
                delay: '1500',
                crafting_queue_min: '5',
                crafting_quality: '0',
                crafting_item: '55',
                carving_queue_min: '5',
                bot_channel_name: '',
                bot_channel_password: '',
                event_channel_name: '',
                event_channel_password: '',
                main_username: '',
                min_crystals: '10',
                min_resources: '500000',
                default_ts: 'fishing',
                mob_count: '500',
                mobs_to_move: '1',
                debug: false,
            },
            readonly: {
                alt_room_id: 0,
                event_room_id: 0
            },
            tags: []
        },
        values: null,
        load() {
            let v = JSON.parse(localStorage.getItem('betabot_v1_settings')) || this.default
            this.values = _.defaultsDeep(v, this.default)
        },
        get(item) {
            return _.get(this.values, item)
        },
        set(item, value) {
            _.set(this.values, item, value)
            this.save()
            this.debug()
            checkIfAlt() // In case this change is to main username.
        },
        export() {
            return JSON.stringify(this.values)
        },
        import(string) {
            try {
                let v = JSON.parse(string)
                this.values = v
                this.save()
                setOptions()
                log('Import', 'Settings imported')
            } catch (e) {
                console.log(e)
            }
        },
        save() {
            localStorage.setItem('betabot_v1_settings', JSON.stringify(this.values))
        },
        debug() {
            $('#bot-debug').text(JSON.stringify(this.values, null, 2))
        }
    }

    let altsWhoIgnoreCommands = [
    ]

    let messages = {
        incoming(event, data) {
            if (data.hasOwnProperty('c_id') && (data.c_id !== vars.channelId && data.c_id !== vars.eventChannelID)) {
                return
            }

            let highestTime = localStorage.getItem('betabot_v1_chat_time') || '0'

            if (data.time <= parseInt(highestTime)) {
                return
            }

            localStorage.setItem('betabot_v1_chat_time', data.time)

            log(true, 'Message on alt channel: ' + data.m)

            if (data.c_id === vars.eventChannelID) {
                messages.parseEvent(data.m)
            } else {
                messages.parse(data.m)
            }
        },
        parse(message) {
            parts = message.trim().split('|')

            switch(parts[0]) {
                case 'command':
                    if (vars.isAlt) {
                        messages.command(parts)
                    }
                    break;

                case 'override':
                    if (vars.isAlt) {
                        messages.override(parts)
                    }
                    break;

                default:
                    return
                    break;
            }
        },
        parseEvent(message) {
            message = message.trim()
            if (message == 'InitEvent') {
                log(true, 'Starting Event')
                let action = settings.get('event.base_action') == 'ts' ? settings.get('setting.default_ts') : settings.get('event.base_action')
                actions.changeEvent(action)
                return
            }
            log(true, 'Unknown message ' + message)
        },
        command(parts) {
            log(true, 'Command Sent')
            switch(parts[1]) {
                case 'send_currency':
                    if (parts[2] == vars.username) break

                    items = parts[3].split(',')
                    let commandParts = []

                    if (items.includes('crystals')) {
                        let total = parseInt($("td.mypremium").attr('data-personal').replace(/,/g, ''))
                        let min = parseInt(settings.get('setting.min_crystals'))
                        if (total > min) {
                            commandParts.push((total - min) + ' crystals')
                        }
                    }
                    if (items.includes('platinum')) {
                        let total = parseInt($("td.myplatinum").attr('data-personal').replace(/,/g, ''))
                        commandParts.push(total + ' platinum')
                    }
                    if (items.includes('gold')) {
                        let total = parseInt($("td.mygold").attr('data-personal').replace(/,/g, ''))
                        commandParts.push(total + ' gold')
                    }
                    if (items.includes('gem_fragments')) {
                        let total = parseInt($("td.mygem_fragments").attr('data-personal').replace(/,/g, ''))
                        commandParts.push(total + ' gem_fragments')
                    }
                    if (items.includes('crafting_materials')) {
                        let total = parseInt($("td.mycrafting_materials").attr('data-personal').replace(/,/g, ''))
                        commandParts.push(total + ' crafting_materials')
                    }
                    if (items.includes('food')) {
                        let total = parseInt($("td.myfood").attr('data-personal').replace(/,/g, ''))
                        let min = parseInt(settings.get('setting.min_resources'))
                        if (total > min) {
                            commandParts.push((total - min) + ' food')
                        }
                    }
                    if (items.includes('wood')) {
                        let total = parseInt($("td.mywood").attr('data-personal').replace(/,/g, ''))
                        let min = parseInt(settings.get('setting.min_resources'))
                        if (total > min) {
                            commandParts.push((total - min) + ' wood')
                        }
                    }
                    if (items.includes('iron')) {
                        let total = parseInt($("td.myiron").attr('data-personal').replace(/,/g, ''))
                        let min = parseInt(settings.get('setting.min_resources'))
                        if (total > min) {
                            commandParts.push((total - min) + ' iron')
                        }
                    }
                    if (items.includes('stone')) {
                        let total = parseInt($("td.mystone").attr('data-personal').replace(/,/g, ''))
                        let min = parseInt(settings.get('setting.min_resources'))
                        if (total > min) {
                            commandParts.push((total - min) + ' stone')
                        }
                    }

                    if (commandParts.length > 0) {
                        chat.sendAny('/wire ' + parts[2] + ' ' + commandParts.join(', '))
                    }
                    break;

                case 'send_ingredients':
                    ingredients.send(parts[2])
                    break;

                case 'tc_train':
                    let command = parts[2]
                    if (command == 'current')
                        trainingCenter.trainCurrentAction()
                    else
                        trainingCenter.train(command)
                    break;

                case 'tc_switch':
                    trainingCenter.switch(parts[2])
                    break;

                case 'build_one':
                    housing.build()
                    break;

                case 'buy_stamina':
                    crystalBoosts.buyStamina()
                    break;

                case 'switch_action':
                    if (altsWhoIgnoreCommands.includes(vars.username)) return

                    switch(parts[2]) {
                        case 'battle':
                        case 'fishing':
                        case 'woodcutting':
                        case 'mining':
                        case 'stonecutting':
                        case 'crafting':
                        case 'carving':
                            actions.change(parts[2])
                            break;
                        case 'ts':
                            actions.change(settings.get('setting.default_ts'))
                    }
                    break;

                case 'switch_event_action':
                    switch(parts[2]) {
                        case 'battle':
                        case 'fishing':
                        case 'woodcutting':
                        case 'mining':
                        case 'stonecutting':
                        case 'crafting':
                        case 'carving':
                            actions.changeEvent(parts[2])
                            break;
                        case 'ts':
                            actions.changeEvent(settings.get('setting.default_ts'))
                        case 'default':
                            actions.changeEvent(settings.get('event.base_action'))
                    }
                    break;

                case 'toggle_timers':
                    timers.toggle()
                    break;

                case 'advent_calendar':
                    misc.advent.start()
                    break;

                case 'initial_tools':
                    log(true, 'Buy tools command')
                    misc.initial_equipment.start()
                    break;

                case 'scrap':
                    log(true, 'Scrap all')
                    equipment.scrap()
                    break;

                case 'disposal':
                    log(true, 'Setting garbage disposal')
                    housing.disposal()
                    break;
            }
        },
        override(parts) {
            let sets = parts[1].split(',')
            sets.forEach(v => {
                let [
                    type,
                    key,
                    value
                ] = v.split(':')
                if (value === 'true' || value === 'false') {
                    value = value === 'true'
                }
                settings.set(type + '.' + key, value)
                setOption(type, key, value)
            })
        }
    }

    let actions = {
        change(to) {
            switch(to) {
                case 'battle':
                    $('a#loadBattle').click()
                    break;

                case 'fishing':
                    $('a.loadHarvesting[data-resource="food"]').click()
                    break;

                case 'woodcutting':
                    $('a.loadHarvesting[data-resource="wood"]').click()
                    break;

                case 'mining':
                    $('a.loadHarvesting[data-resource="iron"]').click()
                    break;

                case 'stonecutting':
                    $('a.loadHarvesting[data-resource="stone"]').click()
                    break;

                case 'crafting':
                    crafting.start()
                    break;

                case 'carving':
                    carving.start()
                    break;
            }
        },
        changeEvent(to) {
            switch(to) {
                case 'battle':
                    $('a.bossFight').click()
                    break;

                case 'fishing':
                    $('a.bossHarvest[data-res="food"]').click()
                    break;

                case 'woodcutting':
                    $('a.bossHarvest[data-res="wood"]').click()
                    break;

                case 'mining':
                    $('a.bossHarvest[data-res="iron"]').click()
                    break;

                case 'stonecutting':
                    $('a.bossHarvest[data-res="stone"]').click()
                    break;

                case 'crafting':
                    $('a.bossCraft').click()
                    break;

                case 'carving':
                    $('a.bossCarve').click()
                    break;
            }
        }
    }

    let chat = {
        sendAny(string) {
            $("#chatMessage").html(string)
            $("#chatSendMessage").click()
        },
        async sendAltChannel(string) {
            let old = $("#chatChannel :selected").val()
            let custom = $('#chatChannel #channel' + settings.get('setting.bot_channel_name')).val()

            $("#chatChannel").val(custom).change()

            $("#chatMessage").html(string)
            $("#chatSendMessage").click()

            await sleep(500)
            $("#chatChannel").val(old).change()
        },

        async sendEventChannel(string) {
            let old = $("#chatChannel :selected").val()
            let custom = $('#chatChannel #channel' + settings.get('setting.event_channel_name')).val()

            $("#chatChannel").val(custom).change()

            $("#chatMessage").html(string)
            $("#chatSendMessage").click()

            await sleep(500)
            $("#chatChannel").val(old).change()
        }
    }

    let mob_control = {
        moving: false,
        maxMob: false,
        direction: false,
        tracker: [],

        start_move() {
            mob_control.moving = true
            vars.actionPending = true
            mob_control.reset()

            $(document).one('roa-ws:page:town_battlegrounds', mob_control.moveMob)
            click('#battleGrounds')
        },

        async moveMob(e, d) {
            await sleep(settings.get('setting.delay'))
            let index = d.e.findIndex((o) => o.s === 1)
            let newMobI = 0
            let mobsToMove = parseInt(settings.get('setting.mobs_to_move')) //d.room.area === 'A Farm' ? 11 : 1

            if (mob_control.direction == 'up') {
                log('Mob Control', 'Moving Mob Up')
                if (index + mobsToMove === d.e.length) {
                    log('Mob Control', 'Moving City Up')
                    mob_control.moveCity()
                    return
                }
                newMobI = index + mobsToMove
            }

            if (mob_control.direction == 'down') {
                log('Mob Control', 'Moving Mob Down')
                if (index == 0 || index - mobsToMove < 0) {
                    log('Mob Control', 'Moving City Down')
                    mob_control.moveCity()
                    return
                }
                newMobI = index - mobsToMove
            }
            $(document).one('roa-ws:battle', mob_control.moveMob2)

            let newMob = d.e[newMobI]
            $("#enemyList").val(newMob.v)
            click('#autoEnemy')

        },
        moveMob2(e, d) {
            // log('Mob Control', 'Mob Moved')
            mob_control.moving = false
            vars.actionPending = false
        },
        moveCity(e, d) {
            $(document).one('roa-ws:page:town', mob_control.moveCity2)
            click('#basePage')
        },
        moveCity2(e, d) {
            // log('Mob Control', 'Town Loaded')
            $(document).one('roa-ws:page:town_travel', mob_control.moveCity3)
            click('#loadTravel')
        },
        async moveCity3(e, d) {
            // log('Mob Control', 'Travel Loaded')
            $(document).one('roa-ws:page:travel', mob_control.moveCity4)
            await sleep(settings.get('setting.delay'))
            if (mob_control.direction === 'up') {
                $('#area_list option:selected').next().attr('selected', 'selected')
            } else {
                $('#area_list option:selected').prev().attr('selected', 'selected')
            }
            click('#travel_confirm')
        },
        moveCity4(e, d) {
            // log('Mob Control', 'Travel Finished')
            $(document).one('roa-ws:page:town_battlegrounds', mob_control.moveCity5)
            click('#battleGrounds')
        },
        async moveCity5(e, d) {
            // log('Mob Control', 'Selecting Bottom Mob')
            $(document).one('roa-ws:battle', mob_control.moveMob2)
            await sleep(settings.get('setting.delay'))
            if (mob_control.direction === 'up') {
                $("#enemyList option:first").attr('selected', 'selected')
            } else {
                $("#enemyList option:last").attr('selected', 'selected')
            }
            click('#autoEnemy')
        },
        reset() {
            $('#clearBattleStats').click()
            mob_control.tracker = []
        },
        track(e, d) {
            let name = d.results.b.m.n
            if (!(name in mob_control.tracker)) {
                mob_control.tracker[name] = {
                    wins: 0,
                    losses: 0
                }
            }

            if (d.results.b.r) {
                mob_control.tracker[name].wins++
            } else {
                mob_control.tracker[name].losses++
            }

            let t = mob_control.tracker[name]

            let total = t.wins + t.losses

            if (!settings.get('control.mob_control') && $('#bq_info').text().includes('You don\'t currently have a battle quest.')) {
                if (settings.get('control.quest')) {
                    log(true, 'Mob Control Trigger Quest')
                    quest.start('battle')
                }
                return
            }

            /* If we have enough battles and there is no current battle quest do the logic for moving */
            // if (total > parseInt(settings.get('setting.mob_count')) && d.results.p.bq_info2.a == 1) {
            if (total > parseInt(settings.get('setting.mob_count')) && $('#bq_info').text().includes('You don\'t currently have a battle quest.')) {

                if (!settings.get('control.mob_control') || (settings.get('control.mob_control_locket') && isNight())) {
                    mob_control.reset()
                    if (settings.get('control.quest')) {
                        log(true, 'Mob Control Trigger Quest')
                        quest.start('battle')
                    }
                    return
                }
                // log('Mob Control', 'Move mob logic triggered')
                let percent = t.wins / total

                if (percent >= 0.995) {
                    mob_control.direction = 'up'
                } else if (percent <= 0.97) {
                    mob_control.direction = 'down'
                } else {
                    // Stay
                    mob_control.reset()
                    if (settings.get('control.quest')) {
                        log(true, 'Mob Control Trigger Quest')
                        quest.start('battle')
                    }
                    return
                }
                mob_control.start_move()
            }
        }
    }

    let channel = {
        check() {
            $(document).on('roa-ws:chanlist2 roa-ws:notification', channel.result)
            chat.sendAny('/chaninfo ' + settings.get('setting.bot_channel_name'))
            log('Chat', 'Checking chat')
        },
        result(e, d) {
            if (!vars.checkingChannel) {
                $(document).off('roa-ws:chanlist2 roa-ws:notification', channel.result)
                return
            }

            if (d.type === 'chanlist2') {
                log('Chat', 'In Channel')
                vars.checkingChannel = false
                $(document).off('roa-ws:chanlist2 roa-ws:notification', channel.result)
                let id  = parseInt($('#chatChannel #channel' + settings.get('setting.bot_channel_name')).val())
                channel.setId(id)
                log('Chat', 'Channel ID: ' + id)
                return
            }

            if (d.m.includes("That channel doesn't seem to exist")) {
                log('Chat', 'Creating Channel')
                chat.sendAny('/create ' + settings.get('setting.bot_channel_name') + ' #259663 ' + settings.get('setting.bot_channel_password'))
                setTimeout(channel.check, 30 * 1000)
            }

            if (d.m.includes("You aren't listening to the")) {
                log('Chat', 'Joining Channel')
                chat.sendAny('/join ' + settings.get('setting.bot_channel_name') + ' ' + settings.get('setting.bot_channel_password'))
                setTimeout(channel.check, 30 * 1000)
            }
        },
        setId(id) {
            if (id != vars.channelId) {
                vars.channelId = id
                settings.set('readonly.alt_room_id', id)
            }
        }
    }

    let channelEvent = {
        check() {
            if (settings.get('setting.event_channel_name') === '') {
                return // Not set so lets not check it
            }
            $(document).on('roa-ws:chanlist2 roa-ws:notification', channelEvent.result)
            setTimeout(() => chat.sendAny('/chaninfo ' + settings.get('setting.event_channel_name')), 1500)
            log('Chat', 'Checking Event Channel')
        },
        result(e, d) {
            if (!vars.checkingEventChannel) {
                $(document).off('roa-ws:chanlist2 roa-ws:notification', channelEvent.result)
                return
            }

            if (d.type === 'chanlist2') {
                log('Chat', 'In Event Channel')
                vars.checkingEventChannel = false
                $(document).off('roa-ws:chanlist2 roa-ws:notification', channelEvent.result)
                let id = parseInt($('#chatChannel #channel' + settings.get('setting.event_channel_name')).val())
                channelEvent.setId(id)
                log('Chat', 'Event Channel ID: ' + id)
                return
            }

            if (d.m.includes("That channel doesn't seem to exist")) {
                log('Chat', 'Creating Event Channel')
                chat.sendAny('/create ' + settings.get('setting.event_channel_name') + ' #259663 ' + settings.get('setting.event_channel_password'))
                setTimeout(channelEvent.check, 30 * 1000)
            }

            if (d.m.includes("You aren't listening to the")) {
                log('Chat', 'Joining Event Channel')
                chat.sendAny('/join ' + settings.get('setting.event_channel_name') + ' ' + settings.get('setting.event_channel_password'))
                setTimeout(channelEvent.check, 30 * 1000)
            }
        },
        setId(id) {
            if (id != vars.eventChannelID) {
                vars.eventChannelID = id
                settings.set('readonly.event_room_id', id)
            }
        }
    }

    let quest = {
        type: null,
        async stop(type) {
            quest.type = type
            vars.actionPending = true
            log(true, 'Quest stopping: ' + type)
            await sleep(settings.get('setting.delay'))
            $(document).one('roa-ws:page:quests', quest.stop2)
            click('a.questCenter')
        },
        async start(type) {
            quest.type = type
            vars.actionPending = true
            log(true, 'Quest starting: ' + type)
            await sleep(settings.get('setting.delay'))
            $(document).one('roa-ws:page:quests', quest.start2)
            click('a.questCenter')
        },
        async stop2(event, data) {
            await sleep(settings.get('setting.delay'))

            setTimeout(() =>{ // This seemed to get triggered twice for some reason so we need the delay here
                $(document).one('roa-ws:page:quest_complete', quest.done)
            }, 500)

            let maxReward = parseInt(document.querySelector('.max_quest_crystals').textContent);
            if (!isNaN(maxReward)) {
                document.querySelectorAll('.quest_crystal_guess').forEach((e) => {
                    e.value = maxReward;
                });
            }

            if (quest.type == 'battle') {
                click("input.completeQuest[data-questtype='kill']")
            }
            if (quest.type == 'ts') {
                click("input.completeQuest[data-questtype='tradeskill']")
            }
            if (quest.type == 'professional') {
                click("input.completeQuest[data-questtype='profession']")
            }
        },
        async start2(event, data) {
            await sleep(settings.get('setting.delay'))
            $(document).one('roa-ws:page:quest_request', quest.done)
            if (quest.type == 'battle') {
                click("input.questRequest[data-questtype='kill']")
            }
            if (quest.type == 'ts') {
                click("input.questRequest[data-questtype='tradeskill']")
            }
            if (quest.type == 'professional') {
                click("input.questRequest[data-questtype='profession']")
            }
        },
        done(event, data) {
            quest.type = null
            finish()
        }
    }

    let harvestron = {
        next: 'food',
        start() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', harvestron.step1)
            click("a#harvestronNotifier")
        },
        async step1(event, data) {
            $(document).one('roa-ws:page:house_harvest_job', finish)
            await sleep(settings.get('setting.delay'))
            let type = settings.get('control.harvestron_type')
            let tmp = [
                {
                    name: 'food',
                    level: getInt($('td#fishing').text()),
                    res: getInt($("td.myfood").attr('data-personal'))
                },
                {
                    name: 'wood',
                    level: getInt($('td#woodcutting').text()),
                    res: getInt($("td.mywood").attr('data-personal'))
                },
                {
                    name: 'iron',
                    level: getInt($('td#mining').text()),
                    res: getInt($("td.myiron").attr('data-personal'))
                },
                {
                    name: 'stone',
                    level: getInt($('td#stonecutting').text()),
                    res: getInt($("td.mystone").attr('data-personal'))
                },
            ]

            if (type == 'lowest_level') {
                tmp.sort((a, b) => a.level - b.level)
                type = tmp.shift().name
            }

            if (type == 'highest_level') {
                tmp.sort((a, b) => b.level - a.level)
                type = tmp.shift().name
            }

            if (type == 'lowest_resource') {
                tmp.sort((a, b) => a.res - b.res)
                type = tmp.shift().name
            }

            if (type == 'highest_resource') {
                tmp.sort((a, b) => b.res - a.res)
                type = tmp.shift().name
            }

            if (type == 'round_robin') {
                type = harvestron.next
                switch(harvestron.next) {
                    case 'food':
                        harvestron.next = 'wood'
                        break;

                    case 'wood':
                        harvestron.next = 'iron'
                        break;

                    case 'iron':
                        harvestron.next = 'stone'
                        break;

                    case 'stone':
                        harvestron.next = 'food'
                        break;
                }
            }

            switch(type) {
                case 'food':
                    $('#houseHarvestingJobSkill').val('0')
                    break;

                case 'wood':
                    $('#houseHarvestingJobSkill').val('1')
                    break;

                case 'iron':
                    $('#houseHarvestingJobSkill').val('2')
                    break;

                case 'stone':
                    $('#houseHarvestingJobSkill').val('3')
                    break;
            }
            $('#houseHarvestingJobTime').val('30')
            click('#houseHarvestingJobStart')
        }
    }

    let trainingCenter = {
        type: false,
        stage: false,
        usablePlat: 0,
        maxGoldUpgrades: 0,
        maxUpgradesAtOnce: 100000,
        retrying: false,

        switch(to) {
            if (!trainingCenter.validateSettings())
                return

            $(document).on('roa-ws:notification', trainingCenter.resetWatch)
            trainingCenter.type = to
            setTimeout(() => trainingCenter.reset(), 250)

        },

        async resetWatch(e, d) {
            if (d.m.includes("You refunded your Training Center investment")) {
                $(document).off('roa-ws:notification', trainingCenter.resetWatch)
                await sleep(500)
                trainingCenter.train(trainingCenter.type)
            }
        },

        reset() {
            chat.sendAny('/tcreset')
        },

        trainCurrentAction() {
            if (['battle', 'crafting', 'carving'].includes(vars.lastAction))
                trainingCenter.train(vars.lastAction)
            else
                trainingCenter.train('ts')
        },

        train(type) {
            if (!trainingCenter.validateSettings())
                return

            vars.actionPending = true

            trainingCenter.type = type
            trainingCenter.stage = 1

            trainingCenter.usablePlat = getInt($('.platinum').first().attr('title')) //Math.min(getInt($('.platinum').first().attr('title')), getInt(settings.get('trainingcenter.max_plat')))
            let gold = getInt($('.gold').first().attr('title')) //Math.min(getInt($('.platinum').first().attr('title')), getInt(settings.get('trainingcenter.max_gold')))


            $('#my-fake-tc-div').attr('title', '').addClass('platinum')
            $('#my-fake-tc-div-2').attr('title', gold / 2).addClass('gold')

            $(document).one('roa-ws:page:training', trainingCenter.step1)
            click("#trainPage")
        },

        async step1(e, d) {
            let oldUsablePlat = parseInt($('#my-fake-tc-div').attr('title'))
            await sleep(500)
            $('#my-fake-tc-div').attr('title', trainingCenter.usablePlat)

            let selectorMax, selectorInput, selectorButton

            if (trainingCenter.retrying) {
                let m = getInt(d.m.match('of(.*)platinum')[1].trim())
                $('#my-fake-tc-div').attr('title', oldUsablePlat - m)
            }

            if (trainingCenter.type == 'crafting') {
                selectorMax = $($('#trainingHarvestingSkills input.max_button')[4])
                selectorInput = $($('#trainingHarvestingSkills input.train_count')[4])
                selectorButton = $($('#trainingHarvestingSkills input.trainSkill')[4])
            }

            if (trainingCenter.type == 'carving') {
                selectorMax = $($('#trainingHarvestingSkills input.max_button')[5])
                selectorInput = $($('#trainingHarvestingSkills input.train_count')[5])
                selectorButton = $($('#trainingHarvestingSkills input.trainSkill')[5])
            }

            if (trainingCenter.type == 'ts' && settings.get('setting.default_ts') == 'fishing') {
                selectorMax = $($('#trainingHarvestingSkills input.max_button')[0])
                selectorInput = $($('#trainingHarvestingSkills input.train_count')[0])
                selectorButton = $($('#trainingHarvestingSkills input.trainSkill')[0])
            }
            if (trainingCenter.type == 'ts' && settings.get('setting.default_ts') == 'woodcutting') {
                selectorMax = $($('#trainingHarvestingSkills input.max_button')[1])
                selectorInput = $($('#trainingHarvestingSkills input.train_count')[1])
                selectorButton = $($('#trainingHarvestingSkills input.trainSkill')[1])
            }
            if (trainingCenter.type == 'ts' && settings.get('setting.default_ts') == 'mining') {
                selectorMax = $($('#trainingHarvestingSkills input.max_button')[2])
                selectorInput = $($('#trainingHarvestingSkills input.train_count')[2])
                selectorButton = $($('#trainingHarvestingSkills input.trainSkill')[2])
            }
            if (trainingCenter.type == 'ts' && settings.get('setting.default_ts') == 'stonecutting') {
                selectorMax = $($('#trainingHarvestingSkills input.max_button')[3])
                selectorInput = $($('#trainingHarvestingSkills input.train_count')[3])
                selectorButton = $($('#trainingHarvestingSkills input.trainSkill')[3])
            }

            if (trainingCenter.type == 'battle' && trainingCenter.stage == 1) {
                selectorMax = $($('#trainingNaturalSkills input.max_button')[0])
                selectorInput = $($('#trainingNaturalSkills input.train_count')[0])
                selectorButton = $($('#trainingNaturalSkills input.trainSkill')[0])
            }
            if (trainingCenter.type == 'battle' && trainingCenter.stage == 2) {
                selectorMax = $($('#trainingNaturalSkills input.max_button')[1])
                selectorInput = $($('#trainingNaturalSkills input.train_count')[1])
                selectorButton = $($('#trainingNaturalSkills input.trainSkill')[1])
            }

            if (trainingCenter.type == 'battle' && trainingCenter.stage == 3) {
                selectorMax = $($('#trainingBattleSkills input.max_button')[0])
                selectorInput = $($('#trainingBattleSkills input.train_count')[0])
                selectorButton = $($('#trainingBattleSkills input.trainSkill')[0])

                if (!trainingCenter.retrying) {
                    let plat = Math.floor(trainingCenter.usablePlat * parseFloat(settings.get('trainingcenter.percent_ms')))
                    $('#my-fake-tc-div').attr('title', plat)
                }
            }
            if (trainingCenter.type == 'battle' && trainingCenter.stage == 4) {
                selectorMax = $($('#trainingBattleSkills input.max_button')[1])
                selectorInput = $($('#trainingBattleSkills input.train_count')[1])
                selectorButton = $($('#trainingBattleSkills input.trainSkill')[1])

                if (!trainingCenter.retrying) {
                    let plat = Math.floor(trainingCenter.usablePlat * parseFloat(settings.get('trainingcenter.percent_chc')))
                    $('#my-fake-tc-div').attr('title', plat)
                }
            }
            if (trainingCenter.type == 'battle' && trainingCenter.stage == 5) {
                selectorMax = $($('#trainingBattleSkills input.max_button')[2])
                selectorInput = $($('#trainingBattleSkills input.train_count')[2])
                selectorButton = $($('#trainingBattleSkills input.trainSkill')[2])

                if (!trainingCenter.retrying) {
                    let plat = Math.floor(trainingCenter.usablePlat * parseFloat(settings.get('trainingcenter.percent_chd')))
                    $('#my-fake-tc-div').attr('title', plat)
                }
            }
            if (trainingCenter.type == 'battle' && trainingCenter.stage == 6) {
                selectorMax = $($('#trainingBattleSkills input.max_button')[3])
                selectorInput = $($('#trainingBattleSkills input.train_count')[3])
                selectorButton = $($('#trainingBattleSkills input.trainSkill')[3])

                if (!trainingCenter.retrying) {
                    let plat = Math.floor(trainingCenter.usablePlat * parseFloat(settings.get('trainingcenter.percent_tou')))
                    $('#my-fake-tc-div').attr('title', plat)
                }
            }
            if (trainingCenter.type == 'battle' && trainingCenter.stage == 7) {
                selectorMax = $($('#trainingBattleSkills input.max_button')[4])
                selectorInput = $($('#trainingBattleSkills input.train_count')[4])
                selectorButton = $($('#trainingBattleSkills input.trainSkill')[4])

                if (!trainingCenter.retrying) {
                    let plat = Math.floor(trainingCenter.usablePlat * parseFloat(settings.get('trainingcenter.percent_cad')))
                    $('#my-fake-tc-div').attr('title', plat)
                }
            }
            if (trainingCenter.type == 'battle' && trainingCenter.stage == 8) {
                selectorMax = $($('#trainingBattleSkills input.max_button')[5])
                selectorInput = $($('#trainingBattleSkills input.train_count')[5])
                selectorButton = $($('#trainingBattleSkills input.trainSkill')[5])

                if (!trainingCenter.retrying) {
                    let plat = Math.floor(trainingCenter.usablePlat * parseFloat(settings.get('trainingcenter.percent_hb')))
                    $('#my-fake-tc-div').attr('title', plat)
                }
            }

            selectorMax.click()
            await sleep(settings.get('setting.delay'))
            // TODO: Right here do a loop or something,
            let int = parseInt(selectorInput.val())
            if (int > trainingCenter.maxUpgradesAtOnce) {
                selectorInput.val(trainingCenter.maxUpgradesAtOnce)
                trainingCenter.retrying = true
            } else {
                trainingCenter.retrying = false
            }

            if ((trainingCenter.type != 'battle' || trainingCenter.stage == 8) && !trainingCenter.retrying) {
                $(document).one('roa-ws:page:train_skill', trainingCenter.finish)
            } else {
                $(document).one('roa-ws:page:train_skill', trainingCenter.step1)
            }

            if (trainingCenter.type == 'battle' && !trainingCenter.retrying) {
                trainingCenter.stage++
                if (trainingCenter.stage % 2 == 0)
                    vars.actionCount = 0 // This should take a while so I need to reset this to keep the bot from thinking it got borked
            }

            await sleep(200)
            selectorButton.click()

        },

        finish() {
            $('#my-fake-tc-div').attr('title', '').removeClass('platinum')
            $('#my-fake-tc-div-2').attr('title', '').removeClass('gold')
            finish()
        },

        validateSettings() {
            let total = parseFloat(settings.get('trainingcenter.percent_ms')) +
                parseFloat(settings.get('trainingcenter.percent_chc')) +
                parseFloat(settings.get('trainingcenter.percent_chd')) +
                parseFloat(settings.get('trainingcenter.percent_tou')) +
                parseFloat(settings.get('trainingcenter.percent_cad')) +
                parseFloat(settings.get('trainingcenter.percent_hb'))

            if (total !== 1) {
                $('#training-center-ratio-message').html(`<span style="color: #eb001f">Invalid ratio, your rates need to equal 1 and yours is ${total}</span>`)
                return false
            }

            $('#training-center-ratio-message').html(`<span style="color: #42db18">Valid ratio</span>`)
            return true
            //
        }
    }

    let crystalBoosts = {
        buyStamina() {
            vars.actionPending = true
            $(document).one('roa-ws:page:boosts', crystalBoosts.buyStamina2)
            click("li#premiumShop")
        },

        async buyStamina2(e, d) {
            await sleep(settings.get('setting.delay'))
            $(document).one('roa-ws:page:boost_purchase_stamina', finish)
            $('#max_button_autos').click()
            await sleep(250)
            let t = parseInt($('#autos_to_buy').val())
            if (t > 1000) {
                $('#autos_to_buy').val('1000')
            }
            await sleep(250)
            $('#increaseAutos').click()
        }
    }

    let housing = {
        build() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house', housing.step1)
            click("li#housing")
        },
        async step1(event, data) {
            await sleep(settings.get('setting.delay'))
            // Build Slowest
            if (settings.get('control.construction_type') === 'slowest') {
                $(document).one('roa-ws:page:house_room_item', housing.upgrade)
                await sleep(settings.get('setting.delay'))
                $("#houseQuickBuildList li:last").find(".houseViewRoomItem").click()
            } else {
                // Build Room
                if ($("#houseRoomCanBuild").is(":visible")) {
                    $(document).one('roa-ws:page:house_build_room', housing.step3)
                    await sleep(settings.get('setting.delay'))
                    $("#houseBuildRoom")[0].click()
                // Build item
                } else if ($("#houseQuickBuildList li:first").find(".houseViewRoom").length == 1) {
                    $(document).one('roa-ws:page:house_room', housing.build_item)
                    await sleep(settings.get('setting.delay'))
                    $("#houseQuickBuildList li:first").find(".houseViewRoom").click()
                // Build Quickest
                } else {
                    await sleep(settings.get('setting.delay'))
                    let first = $("#houseQuickBuildList li:first")

                    // Remove Mannequin
                    if (first.text().includes('Mannequin')) {
                        $(document).one('roa-ws:page:house_ignore_build', housing.ignore)
                        await sleep(settings.get('setting.delay'))
                        first.find('.houseIgnoreQuickBuild').click()
                        return
                    }

                    // Clean house items after level 37
                    if (data.l >= 30 && settings.get('control.construction_cleanup')) {
                        let accepted = [
                            "Battle Experience Boost",
                            "Stat Drop Boost",
                            "Drop Boost",
                            "Gold Boost",
                            "Construction Boost"
                        ]
                        let agi = 0,
                            hp = 0,
                            str = 0,
                            coord = 0,
                            qb = 0,
                            apen
                        try {
                            //fhc = parseInt(data.bonuses.Miscellaneous[94].split(" ", 1)[0].replace('+', '').replace('%', ''))
                            agi = parseFloat(data.bonuses.Stats[17].replace(/  /g, ' ').split(' ', 3)[1].replace('(', '').replace(')', '').replace('%', ''))
                            hp = parseFloat(data.bonuses.Stats[15].replace(/  /g, ' ').split(' ', 3)[1].replace('(', '').replace(')', '').replace('%', ''))
                            str = parseFloat(data.bonuses.Stats[14].replace(/  /g, ' ').split(' ', 3)[1].replace('(', '').replace(')', '').replace('%', ''))
                            coord = parseFloat(data.bonuses.Stats[16].replace(/  /g, ' ').split(' ', 3)[1].replace('(', '').replace(')', '').replace('%', ''))
                            qb = parseInt(data.bonuses["Crystal Shop"][64].split(" ", 1)[0].replace('+', '').replace('%', ''))
                            apen = parseFloat(data.bonuses.Miscellaneous[97].split(" ", 1)[0].replace('+', '').replace('%', ''))
                        } catch(e) {}

                        // if (fhc < 50) {
                        //     accepted.push("First Hit Chance")
                        // }
                        if (str < 40) {
                            accepted.push('Strength')
                        }
                        if (coord < 40) {
                            accepted.push('Coordination')
                        }
                        if (hp < 40) {
                            accepted.push('Health')
                        }
                        if (agi < 80) {
                            accepted.push('Agility')
                        }
                        if (qb < 150) {
                            accepted.push('Quest Boost')
                        }
                        if (apen < 50) {
                            accepted.push('Armor Penetration')
                        }

                        let firstBonus = first.find('span').text()
                        if (!accepted.some(v => firstBonus.includes(v))) {
                            $(document).one('roa-ws:page:house_ignore_build', housing.ignore)
                            await sleep(settings.get('setting.delay'))
                            first.find('.houseIgnoreQuickBuild').click()
                            return
                        }
                    }

                    // Build if nothing needs cleaned
                    let firstLink = first.find(".houseViewRoomItem")
                    if (firstLink.hasClass('disabled')) {
                        settings.set('control.construction', false)
                        setOptions()
                        housing.step3()
                        return
                    }
                    $(document).one('roa-ws:page:house_room_item', housing.upgrade)
                    await sleep(settings.get('setting.delay'))
                    firstLink.click()
                }
            }
        },
        async upgrade(event, data) {
            await sleep(settings.get('setting.delay'))
            if ($("#houseRoomItemUpgradeTier").is(":visible")) {
                $(document).one('roa-ws:page:house_room_item_upgrade_tier', housing.step3)
                await sleep(settings.get('setting.delay'))
                $("#houseRoomItemUpgradeTier").click()
            } else {
                $(document).one('roa-ws:page:house_room_item_upgrade_level', housing.step3)
                await sleep(settings.get('setting.delay'))
                $("#houseRoomItemUpgradeLevel").click()
            }
        },
        async build_item(event, data) {
            await sleep(settings.get('setting.delay'))
            $(document).one('roa-ws:page:house_build_room_item', housing.step3)
            await sleep(settings.get('setting.delay'))
            $("#houseBuildRoomItem").click()
        },
        async ignore(event, data) {
            await sleep(settings.get('setting.delay'))
            housing.build()
        },
        async step3(event, data) {
            await sleep(settings.get('setting.delay'))
            setTimeout(() => { // Because of v fucked this with queued rooms
                vars.actionPending = false
                vars.actionCount = 0
            }, 6000)

            $(".closeModal").click()
        },

        disposal(event, data) {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', housing.disposal2)
            openHouseRoom(3, 91)
        },
        async disposal2(event, data) {
            $(document).one('roa-ws:page:house_trash_compactor_setting', housing.step3)
            await sleep(settings.get('setting.delay'))
            let highest = 0
            $('#houseTrashCompactorToggle option').each(function() {
                let val = parseInt($(this).attr('value'))
                if (val <= 5) {
                    if (val > highest) {
                        highest = val
                    }
                }
            })

            $('#houseTrashCompactorToggle').val(highest)
            $('#houseTrashCompactorCraftingToggle').val(3)
            $('#houseTrashCompactorSelect').click()
        }
    }

    let crafting = {
        queue: [],
        items: {
            Sword: '0',
            Staff: '1',
            Bow: '2',
            Helmet: '50',
            Breastplate: '51',
            Gloves: '52',
            Boots: '53',
            Shield: '54',
            Quiver: '55'
        },
        presets: {
            BxpSetOld(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '29', '48', '60']},
                    {level, type: crafting.items.Helmet, filters: ['26', '29', '70', '60']},
                    {level, type: crafting.items.Breastplate, filters: ['26', '29', '70', '60']},
                    {level, type: crafting.items.Gloves, filters: ['26', '29', '70', '60']},
                    {level, type: crafting.items.Boots, filters: ['26', '29', '70', '60']},
                    {level, type: crafting.items.Shield, filters: ['26', '29', '70', '60']}
                ]
            },
            BxpSet(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '30', '48', '60']},
                    {level, type: crafting.items.Helmet, filters: ['20', '30', '70', '60']},
                    {level, type: crafting.items.Breastplate, filters: ['20', '30', '70', '60']},
                    {level, type: crafting.items.Gloves, filters: ['20', '30', '70', '60']},
                    {level, type: crafting.items.Boots, filters: ['20', '30', '70', '60']},
                    {level, type: crafting.items.Shield, filters: ['20', '30', '70', '60']}
                ]
            },
            CraftingSet(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '38', '66', '62']},
                    {level, type: crafting.items.Helmet, filters: ['26', '38', '70', '62']},
                    {level, type: crafting.items.Breastplate, filters: ['26', '38', '70', '62']},
                    {level, type: crafting.items.Gloves, filters: ['26', '38', '70', (level >= 6500 ? '63' : '62')]},
                    {level, type: crafting.items.Boots, filters: ['26', '38', '70', (level >= 5000 ? '63' : '62')]},
                    {level, type: crafting.items.Shield, filters: ['26', '38', '70', (level >= 3500 ? '63' : '62')]}
                ]
            },
            CarvingSet(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '39', '66', '62']},
                    {level, type: crafting.items.Helmet, filters: ['26', '39', '70', '62']},
                    {level, type: crafting.items.Breastplate, filters: ['39', '38', '70', '62']},
                    {level, type: crafting.items.Gloves, filters: ['26', '39', '70', (level >= 6500 ? '63' : '62')]},
                    {level, type: crafting.items.Boots, filters: ['26', '39', '70', (level >= 5000 ? '63' : '62')]},
                    {level, type: crafting.items.Shield, filters: ['26', '39', '70', (level >= 3500 ? '63' : '62')]}
                ]
            },
            Fishing(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '33', '66', '37']},
                    {level, type: crafting.items.Helmet, filters: ['26', '33', '70', '37']},
                    {level, type: crafting.items.Breastplate, filters: ['26', '33', '70', '37']},
                    {level, type: crafting.items.Gloves, filters: ['26', '33', '70', '37']},
                    {level, type: crafting.items.Boots, filters: ['26', '33', '70', '37']},
                    {level, type: crafting.items.Shield, filters: ['26', '33', '70', '37']}
                ]
            },
            WoodCutting(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '34', '66', '37']},
                    {level, type: crafting.items.Helmet, filters: ['26', '34', '70', '37']},
                    {level, type: crafting.items.Breastplate, filters: ['26', '34', '70', '37']},
                    {level, type: crafting.items.Gloves, filters: ['26', '34', '70', '37']},
                    {level, type: crafting.items.Boots, filters: ['26', '34', '70', '37']},
                    {level, type: crafting.items.Shield, filters: ['26', '34', '70', '37']}
                ]
            },
            Mining(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '35', '66', '37']},
                    {level, type: crafting.items.Helmet, filters: ['26', '35', '70', '37']},
                    {level, type: crafting.items.Breastplate, filters: ['26', '35', '70', '37']},
                    {level, type: crafting.items.Gloves, filters: ['26', '35', '70', '37']},
                    {level, type: crafting.items.Boots, filters: ['26', '35', '70', '37']},
                    {level, type: crafting.items.Shield, filters: ['26', '35', '70', '37']}
                ]
            },
            StoneCutting(level) {
                return [
                    {level, type: crafting.items.Sword, filters: ['22', '36', '66', '37']},
                    {level, type: crafting.items.Helmet, filters: ['26', '36', '70', '37']},
                    {level, type: crafting.items.Breastplate, filters: ['26', '36', '70', '37']},
                    {level, type: crafting.items.Gloves, filters: ['26', '36', '70', '37']},
                    {level, type: crafting.items.Boots, filters: ['26', '36', '70', '37']},
                    {level, type: crafting.items.Shield, filters: ['26', '36', '70', '37']}
                ]
            }
        },
        fill() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', crafting.fill_2)
            click(".craftingTableLink")
        },
        async fill_2(event, data) {
            $(document).one('roa-ws:page:craft_item', finish)
            await sleep(settings.get('setting.delay'))
            $("#craftingItemLevelMax").click()
            $("#craftingQuality").val(settings.get('setting.crafting_quality'))
            $("#craftingType").val(settings.get('setting.crafting_item'))
            $("#houseCraftingVetoList").multiSelect('deselect_all')
            $("#craftingJobFillQueue").click()
            click('.craftingJobStartQueue[data-position="back"]')
        },
        start() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', crafting.start_2)
            click(".craftingTableLink")
        },
        async start_2(event, data) {
            $(document).one('roa-ws:page:craft_item', finish)
            await sleep(settings.get('setting.delay'))
            if ($("#craft_sortable span.itemWithTooltip").length > 0) {
                click('#craft_sortable .craftingResumeButton:first')
            } else {
                $("#craftingItemLevelMax").click()
                $("#craftingQuality").val(settings.get('setting.crafting_quality'))
                $("#craftingType").val(settings.get('setting.crafting_item'))
                $("#houseCraftingVetoList").multiSelect('deselect_all')
                $("#craftingJobFillQueue").click()
                click('#craftingJobStart')
            }
        },
        addToQueue(level, type, filters) {
            crafting.queue.push({
                level,
                type,
                filters
            })
        },
        addPresetToQueue(preset, times = 1) {
            for (i = 0; i < times; i++) {
                preset.forEach(item => {
                    crafting.addToQueue(item.level, item.type, item.filters)
                })
            }
        },
        addFromQueue() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', crafting.addFromQueue_2)
            click(".craftingTableLink")
        },
        async addFromQueue_2(event, data) {
            $(document).one('roa-ws:page:craft_item', finish)
            await sleep(settings.get('setting.delay'))
            let item = crafting.queue.shift()
            $("#craftingItemLevel").val(item.level)
            $("#craftingQuality").val('7')
            $("#craftingType").val(item.type)
            $("#houseCraftingVetoList").multiSelect('select_all')

            await sleep(200)
            $("#houseCraftingVetoList").multiSelect('deselect', item.filters)
            await sleep(200)
            click('.craftingJobStartQueue[data-position="back"]')
        },
    }

    let carving = {
        fill() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', carving.fill_2)
            click('.carvingBenchLink')
        },
        async fill_2(event, data) {
            $(document).one('roa-ws:page:carve_gem', finish)
            await sleep(settings.get('setting.delay'))
            let maxLevel = $('#carvingItemLevel option:last').val()
            let efficentLevel = maxLevel - (maxLevel + 1) % 3 // KLeeping this around but not used because training gems
            $('#carvingItemLevel').val(maxLevel)
            $('#carvingType').val('65535')
            let gemsToAdd = Math.min(15, $('#carvingJobCountMax').attr('data-max'))
            $('#carvingJobCount').val(gemsToAdd)
            click('.carvingJobStartQueue[data-position="back"]')
        },
        start() {
            vars.actionPending = true
            $(document).one('roa-ws:page:house_room_item', carving.start_2)
            click('.carvingBenchLink')
        },
        async start_2(event, data) {
            $(document).one('roa-ws:page:carve_gem', finish)
            await sleep(settings.get('setting.delay'))
            // Resume current gems
            if ($("#carve_sortable span.gemWithTooltip").length > 0) {
                click('#carve_sortable .carvingResumeButton:first')
            } else {
                let maxLevel = $('#carvingItemLevel option:last').val()
                // let efficentLevel = maxLevel - (maxLevel + 1) % 3
                // $('#carvingItemLevel').val(efficentLevel)
                $('#carvingItemLevel').val(maxLevel)
                $('#carvingType').val('65535')
                let gemsToAdd = Math.min(30, $('#carvingJobCountMax').attr('data-max'))
                $('#carvingJobCount').val(gemsToAdd)
                click('#carvingJobStart')
            }
        }
    }

    let spawngem = {
        lastTime: 0,
        queue: [],
        gems: [
            {name: 'None', value: -1},
            {name: 'Strength', value: 0},
            {name: 'Health', value: 1},
            {name: 'Coordination', value: 2},
            {name: 'Agility', value: 3},
            {name: 'Harvesting', value: 46},
            {name: 'Smithing', value: 47},
            {name: 'Etching', value: 48},
            {name: 'Wisdom (Battle Exp)', value: 50},
            {name: 'Greed (Gold)', value: 51},
            {name: 'Luck (Drop)', value: 52},
            {name: 'Mastery (Stat)', value: 53},
            {name: 'Piercing (Armor Pen)', value: 61},
            {name: 'Damage to Plants', value: 28},
            {name: 'Chrono', value: 62}
        ],

        presents: {
            Split: function(level) {
                return [
                    {
                        primary: 28,
                        secondary: 2,
                        level: level,
                        amount: 2
                    },
                    {
                        primary: 51,
                        secondary: 2,
                        level: level,
                        amount: 2
                    },
                    ...spawngem.presents.Base(level)
                ]
            },
            Damage: function(level) {
                return [
                    {
                        primary: 28,
                        secondary: 2,
                        level: level,
                        amount: 4
                    },
                    ...spawngem.presents.Base(level)
                ]
            },
            Gold: function(level) {
                return [
                    {
                        primary: 51,
                        secondary: 2,
                        level: level,
                        amount: 4
                    },
                    ...spawngem.presents.Base(level)
                ]
            },
            Both: function(level) {
                return [
                    {
                        primary: 28,
                        secondary: 2,
                        level: level,
                        amount: 4
                    },
                    {
                        primary: 51,
                        secondary: 2,
                        level: level,
                        amount: 4
                    },
                    ...spawngem.presents.Base(level)
                ]
            },
            Base: function(level) {
                return [
                    {
                        primary: 50,
                        secondary: 0,
                        level: level,
                        amount: 5
                    },
                    {
                        primary: 52,
                        secondary: 2,
                        level: level,
                        amount: 5
                    },
                    {
                        primary: 53,
                        secondary: 1,
                        level: level,
                        amount: 5
                    },
                    {
                        primary: 1,
                        secondary: 0,
                        level: level,
                        amount: 5
                    },
                    {
                        primary: 0,
                        secondary: 1,
                        level: level,
                        amount: 4
                    },
                    {
                        primary: 0,
                        secondary: 62,
                        level: level,
                        amount: 1
                    },
                    {
                        primary: 2,
                        secondary: 61,
                        level: level,
                        amount: 1
                    },
                ]
            }
        },

        addToQueue(primary, secondary, level, amount) {
            spawngem.queue.push({
                primary,
                secondary,
                level,
                amount
            })
            spawngem.updateQueueDisplay()
        },

        addPresetToQueue(present) {
            if (vars.canSpawnGem) {
                vars.canSpawnGem = false
                setTimeout(() => vars.canSpawnGem = true, 2500)
            }

            present.forEach(item => {
                spawngem.addToQueue(item.primary, item.secondary, item.level / 10, item.amount)
            })

            spawngem.updateQueueDisplay()
        },

        async create() {
            vars.actionPending = true
            vars.canSpawnGem = false

            $(document).one('roa-ws:modalContent', spawngem.create_2)
            await sleep(settings.get('setting.delay'))
            chat.sendAny('/spawngem')
        },

        async create_2(e, d) {
            let gem = spawngem.queue.shift()
            $(document).one('roa-ws:page:gem_spawn', spawngem.create_3)

            await sleep(settings.get('setting.delay'))

            $('#spawnGemLevel').val(gem.level)
            $('#gemSpawnType').val(gem.primary)
            $('#gemSpawnSpliceType').val(gem.secondary)
            $('#gemSpawnCount').val(gem.amount > 60 ? 60 : gem.amount)
            click('#gemSpawnConfirm')

            if (gem.amount > 60) {
                gem.amount -= 60
                spawngem.queue.unshift(gem)
            }

            spawngem.updateQueueDisplay()

        },

        async create_3(e, d) {
            setTimeout(() => vars.canSpawnGem = true, 65 * 1000)
            await sleep(settings.get('setting.delay'))
            click('a.green')
            await sleep(settings.get('setting.delay'))
            finish()
        },

        updateQueueDisplay() {
            rows = []

            spawngem.queue.forEach(gem => {
                let pName = spawngem.gems.find(g => g.value == gem.primary)
                let sName = spawngem.gems.find(g => g.value == gem.secondary)
                rows.push(`<tr><td>${pName.name}</td><td>${sName.name}</td><td>${gem.level * 10} / ${gem.level}</td><td>${gem.amount}</td>`)
            })

            $('#spawngem_queue').html(rows.join(`\n`))
        }
    }

    let timers = {
        toggle() {
            vars.actionPending = true
            $(document).one('roa-ws:page:settings_check', timers.step1)
            click('a#settings')
        },
        step1(event, data) {
            $(document).one('roa-ws:page:settings_preferences', timers.step2)
            click('button#settingsAccountPreferences')
        },
        async step2(event, data) {
            $(document).one('roa-ws:page:settings_preferences_change', finish)
            await sleep(settings.get('setting.delay'))
            $('input.preferenceButton[data-type="4"]').click()
            await sleep(settings.get('setting.delay'))
            $('label.switch[for="preference-19-choice-1"]').click()
            $('label.switch[for="preference-19-choice-2"]').click()
            $('label.switch[for="preference-19-choice-4"]').click()
            $('label.switch[for="preference-19-choice-8"]').click()
            click('input#settingsSavePreferenceChanges')
        }
    }

    let ingredients = {
        to: null,
        send(to) {
            if (to == vars.username) return
            this.to = to
            vars.actionPending = true
            $(document).one('roa-ws:page:equipment', ingredients.step1)
            click('li#inventory')
        },
        step1(event, data) {
            $(document).one('roa-ws:page:inventory_ingredients', ingredients.step2)
            click('button.inventoryLoad[data-itemtype="ingredient"]')
        },
        step2(event, data) {
            let ings = []
            data.result.forEach((ingredient) => {
                if (ingredient.v <= 0 || !ingredient.m) return

                let nameChanged = ingredient.n.replace(/ /g, '_').replace('Chunk_of_', '')

                ings.push(ingredient.v + ' ' + nameChanged)
            })

            if (ings.length === 0) {
                ingredients.finish()
                return
            }

            let wires = []
            while(ings.length > 0) {
                wires.push(ings.splice(0, 10))
            }
            let i = 0
            wires.forEach((ings) => {
                setTimeout(()=> {
                    let command = `/iwire ${ingredients.to} ${ings.join(', ')}`
                    chat.sendAny(command)
                }, (i * 5500))
                i++
            })
            setTimeout(()=> { ingredients.finish() }, (((i - 1) * 5500) + 1000) )
        },
        async finish() {
            this.to = null
            await sleep(settings.get('setting.delay'))
            finish()
        }
    }

    let controller = {
        checkGeneral(event, data) {
            controller.checkStamina(event, data)

            switch(data.type) {
                case 'battle':
                    vars.lastAction = 'battle'
                    break;
                case 'harvest':
                    vars.lastAction = data.results.a.s
                    break;
                case 'craft':
                    vars.lastAction = 'crafting'
                    break;
                case 'carve':
                    vars.lastAction = 'carving'
                    break;
            }

            if (vars.actionPending) {
                vars.actionCount++
                if (vars.actionCount > vars.maxActionCount) {
                    vars.actionPending = false
                    vars.actionCount = 0
                } else {
                    return
                }
            } else {
                if (vars.actionCount > 0) {
                    vars.actionCount = 0
                }
            }

            /* Events */
            let eventTimeLeft = data.results.p.event_end || null
            if (eventTimeLeft !== null && settings.get('event.join') && eventTimeLeft <= (settings.get('event.join_time') * 60)) {
                let action = settings.get('event.base_action') == 'ts' ? settings.get('setting.default_ts') : settings.get('event.base_action')
                actions.changeEvent(action)
                return
            }

            if (data.type === 'battle') {
                let level = getInt($('#level').text())
                if (level >= getInt(settings.get('control.max_level'))) {
                    actions.change(settings.get('setting.default_ts'))
                }
            }

            /* Quest Finish */
            if (data.type === 'battle' && $('#bq_info').text().includes('You have completed your')) {
                quest.stop('battle')
                return
            }
            if (data.type === 'harvest' && $('#tq_info').text().includes('You have completed your')) {
                quest.stop('ts')
                return
            }
            if ((data.type === 'craft' || data.type === 'carve') && $('#pq_info').text().includes('You have completed your')) {
                quest.stop('professional')
                return
            }

            if (data.type === 'harvest' && $('#tq_info').text().includes('You don\'t currently have a harvesting quest.') && settings.get('control.quest')) {
                quest.start('ts')
                return
            }
            if ((data.type === 'craft' || data.type === 'carve') && $('#pq_info').text().includes('You don\'t currently have a profession quest.') && settings.get('control.quest')) {
                quest.start('professional')
                return
            }

            if ((data.type === 'craft' || data.type === 'carve' || data.type === 'harvest') && settings.get('control.upgrade_tool_tier')) {
                if (controller.checkToolTier(data)){
                    return
                }
            }

            /* Start the house item building */
            if (settings.get('control.construction') && $('#constructionNotifier').is(':visible')) {
                housing.build()
            }

            /* Start the harvestron */
            if (settings.get('control.harvestron') && $('#harvestronNotifier').is(':visible')) {
                harvestron.start()
            }

           if (spawngem.queue.length > 0 && vars.canSpawnGem && settings.get('control.spawngems')) {
               spawngem.create()
           }

        },
        checkCraftingQueue(event, data) {
            if (vars.actionPending) {
                vars.actionCount++
                if (vars.actionCount > vars.maxActionCount) {
                    vars.actionPending = false
                    vars.actionCount = 0
                } else {
                    return
                }
            }

            if (!settings.get('control.crafting')) {
                return
            }

            if (crafting.queue.length && data.results.a.cq < (data.results.a.mq - 1)) {
                doingSomething = true
                crafting.addFromQueue()
                return
            }

            if (vars.actionPending) {
                return
            }

            if (data.results.a.cq <= settings.get('setting.crafting_queue_min')) {
                crafting.fill()
            }
        },
        checkCarvingQueue(event, data) {
            if (vars.actionPending) {
                vars.actionCount++
                if (vars.actionCount > vars.maxActionCount) {
                    vars.actionPending = false
                    vars.actionCount = 0
                } else {
                    return
                }
            }

            if (vars.actionPending || !settings.get('control.carving')) {
                return
            }

            if (data.results.a.cq <= settings.get('setting.carving_queue_min')) {
                carving.fill()
            }
        },
        checkToolTier(data) {
            let tier = data.results.a.t.split(" ")[0]
            let list = [
                'Plastic',
                'Opal',
                'Emerald',
                'Sapphire',
                'Ruby',
                'Bronze',
                'Amber',
                'Coral',
                'Topaz',
                'Silver',
                'Ivory',
                'Pearl',
                'Jade',
                'Mithril',
                'Golden',
                'Obsidian',
                'Platinum',
                'Diamond',
                'Crystal',
                'Amethyst',
            ]

            let key = list.indexOf(tier)

            if (key < 0 || key == 19) {
                return false // Invalid tool or max tool tier
            }

            let newKey = key + 1
            let cost = newKey * 25

            let level, toolType, levelRequired

            switch(data.type) {
                case 'craft':
                    level = getInt($('td#crafting').text())
                    toolType = 'crafting'
                    levelRequired = newKey * 10
                    break;

                case 'carve':
                    level = getInt($('td#carving').text())
                    toolType = 'carving'
                    levelRequired = newKey * 10
                    break;

                case 'harvest':
                    level = getInt($('td#' + data.results.a.s).text())
                    toolType = data.results.a.r
                    levelRequired = newKey * 50
                    break;

                default:
                    return false
                    break;
            }

            if (level < levelRequired || getCurrency('crystals') < cost) {
                return false
            }

            equipment.buyToolTier(toolType)
            return true
        },
        checkStamina(event, data) {
            if (vars.lastRefreshAttempt > 0 && data.results.p.autos_remaining > 10) {
                vars.lastRefreshAttempt = 0
            }

            if (settings.get('control.replenish') && data.results.p.autos_remaining <= 10) {
                if (vars.lastRefreshAttempt > 10) {
                    vars.lastRefreshAttempt = 0
                }
                if (vars.lastRefreshAttempt == 0) {
                    $("#replenishStamina").click()
                }
                vars.lastRefreshAttempt++
            }
        },
        checkEvent(event, data) {
            controller.checkStamina(event, data)
            let currentAction = null

            if (typeof data.results.carveInfo === 'string') {
                currentAction = 'carving'
            }
            if (typeof data.results.craftInfo === 'string') {
                currentAction = 'crafting'
            }
            if (typeof data.results.harvestInfo === 'string') {
                currentAction = 'ts'
            }
            if (typeof data.results.battleInfo === 'string') {
                currentAction = 'battle'
            }

            // if (currentAction === 'carving' && data.results.carvingTier >= settings.get('event.max_carving')) {
            //     let newAction = settings.get('event.fallback_action') == 'ts' ? settings.get('setting.default_ts') : settings.get('event.fallback_action')
            //     actions.changeEvent(newAction)
            // }

            let minutesToBattle = vars.isAlt ? 2 : 3

            let eventTimeLeft = data.results.p.event_end || null
            if (settings.get('event.switch_to_battle') && (eventTimeLeft !== null && eventTimeLeft <= (minutesToBattle * 60) && currentAction != 'battle')) {
                actions.changeEvent('battle')
                return
            }
        }
    }

    let equipment = {
        type: null,
        buyToolTier(type) {
            vars.actionPending = true
            equipment.type = type
            $(document).one('roa-ws:page:town', equipment.buyToolTier2)
            click('#basePage')
        },
        buyToolTier2(event, data) {
            $(document).one('roa-ws:page:town_blacksmith', equipment.buyToolTier3)
            click('#loadBlacksmith')
        },
        async buyToolTier3(event, data) {
            await sleep(settings.get('setting.delay'))
            let tool = $('a.tool_cost[data-type="' + equipment.type + '"]')
            let tier = parseInt(tool.attr('data-tier'))
            let canBuy = false
            if (tier == 0) {
                let total = getCurrency('gold')
                if (total > 10000) {
                    canBuy = true
                }
            } else {
                let total = getCurrency('crystals')
                if (total >= tier * 25) {
                    canBuy = true
                }
            }

            /* Make sure we have enough to transport the item to highest town */
            /* Possibly fix this to get the gold but I gotta figure out how that even works */
            if (getCurrency('gold') < 22000000) {
                canBuy = false
            }

            if (canBuy) {
                $(document).one('roa-ws:page:buy_item', equipment.buyToolTier4)
                await sleep(settings.get('setting.delay'))
                tool.click()
                await sleep(500)
                $('a.green').click()
            } else {
                equipment.finish()
            }
        },
        buyToolTier4(event, data) {
            if (data.hasOwnProperty('needs_confirm') && data.needs_confirm) {
                $(document).one('roa-ws:page:buy_item', equipment.buyToolTier4)
                click('a.green')
            } else {
                equipment.finish()
            }
        },
        async finish() {
            await sleep(settings.get('setting.delay'))
            vars.actionPending = false
            vars.actionCount = 0
            actions.change(vars.lastAction)
        },

        scrap(event, data) {
            vars.actionPending = true
            $(document).one('roa-ws:page:inventory_items', equipment.scrap2)
            click('#inventory')
        },
        async scrap2(event, data) {
            $(document).one('roa-ws:page:scrap_all_check', equipment.scrap3)
            click('#massScrap')
            await sleep(settings.get('setting.delay'))
            $("#massOption option[id='3']").attr("selected", "selected")
            await sleep(500)
            $("#confirm_mass_scrap").click()
        },
        scrap3(event, data) {
            $(document).one('roa-ws:page:scrap_all', equipment.scrap4)
            click('div#confirmButtons > a.button.green')
        },
        async scrap4(event, data) {
            await sleep(settings.get('setting.delay'))
            $(document).one('roa-ws:page:inventory_items', equipment.scrap5)
            click('a.inventoryLoad[data-itemtype="armor"]')
        },
        async scrap5(event, data) {
            $(document).one('roa-ws:page:scrap_all_check', equipment.scrap6)
            click('#massScrap')
            await sleep(settings.get('setting.delay'))
            $("#massOption option[id='3']").attr("selected", "selected")
            await sleep(500)
            $("#confirm_mass_scrap").click()
        },
        async scrap6(event, data) {
            $(document).one('roa-ws:page:scrap_all', async () => {
                await sleep(500)
                equipment.finish()
            })
            click('div#confirmButtons > a.button.green')
        },
    }

    let tools = {
        type: null,
        upgradedRecent: false,
        checkTool(event, data) {
            if (data.results.a.c_l && !tools.upgradedRecent && settings.get('control.upgrade_tool_level')) {
                tools.upgrade(data.results.a.s)
            }
        },
        upgrade(type) {
            if (tools.upgradedRecent) return
            tools.type = type.charAt(0).toUpperCase() + type.slice(1)
            tools.upgradedRecent = true
            vars.actionPending = true
            setTimeout(() => tools.upgradedRecent = false, 30 * 60 * 1000)
            $(document).one('roa-ws:page:inventory_tools', tools.upgrade2)
            click('a.openToolUpgrade')
        },
        upgrade2(event, data) {
            $(document).one('roa-ws:page:harvest_level_max_check', tools.upgrade3)
            click('a.toolUpgradeMax[data-type="' + tools.type + '"]')
        },
        upgrade3(event, data) {
            $(document).one('roa-ws:page:harvest_level_max', finish)
            click('div#confirmButtons > a.button.green')
        }
    }

    let misc = {
        advent: {
            start() {
                $(document).one('roa-ws:page:event_calendar', misc.advent.step1)
                click('#eventCalendarLink')
            },
            step1(e, d) {
                $("#modal2Content").append(`<a class="advent_calendar_collect thingylink">herro</a>`)
                
                $(document).one('roa-ws:page:event_view', misc.advent.step2)
                click('.thingylink')
            },
            step2(e, d) {
                $(document).one('roa-ws:page:advent_calendar_collect', misc.advent.step3)
                click('a.advent_calendar_collect')
            },
            async step3(e, d) {
                $('.thingylink').remove()
                await sleep(500)
                $('a.green').click()
                await sleep(750)
                $('#modal2Wrapper .closeModal').click()
                await sleep(1500)
                $('#modalWrapper .closeModal').click()
            }
        },
        initial_equipment: {
            index: 0,
            tools: [
                'food',
                'wood',
                'iron',
                'stone',
                'crafting',
                'carving'
            ],
            start() {
                vars.actionPending = true
                misc.initial_equipment.index = 0
                $(document).one('roa-ws:page:town', misc.initial_equipment.step2)
                click('#basePage')
            },
            step2(event, data) {
                $(document).one('roa-ws:page:town_blacksmith', misc.initial_equipment.step3)
                click('#loadBlacksmith')
            },
            async step3(event, data) {
                let type = misc.initial_equipment.tools[misc.initial_equipment.index]
                log('Initial Tools', 'Buying tool type: ' + type)
                await sleep(settings.get('setting.delay'))
                let tool = $('a.tool_cost[data-type="' + type + '"]')
                let tier = parseInt(tool.attr('data-tier'))
                let canBuy = false
                if (tier == 0) {
                    let total = getInt($("td.mygold").attr('data-personal'))
                    if (total > 10000) {
                        canBuy = true
                    }
                } else {
                    log('Initial Tools', 'Tool type: ' + type + ' already purchased')
                }

                if (canBuy) {
                    $(document).one('roa-ws:page:buy_item', misc.initial_equipment.step4)
                    await sleep(settings.get('setting.delay'))
                    tool.click()
                    await sleep(500)
                    $('a.green').click()
                } else {
                    misc.initial_equipment.finish()
                }
            },
            step4(event, data) {
                if (data.hasOwnProperty('needs_confirm') && data.needs_confirm) {
                    $(document).one('roa-ws:page:buy_item', misc.initial_equipment.step4)
                    click('a.green')
                } else {
                    misc.initial_equipment.finish()
                }
            },
            async finish() {
                await sleep(settings.get('setting.delay'))
                if (misc.initial_equipment.index >= misc.initial_equipment.tools.length - 1) {
                    log('Initial Tools', 'All Tools bought')
                    vars.actionPending = false
                    vars.actionCount = 0
                    actions.change(vars.lastAction)
                } else {
                    log('Initial Tools', 'Buying next tool')
                    misc.initial_equipment.index++
                    misc.initial_equipment.step3()
                }
            }
        }
    }

    async function sleep(time, seconds = false) {
        return new Promise(resolve => setTimeout(resolve, (seconds ? parseInt(time) * 1000 : time)))
    }

    async function finish() {
        await sleep(settings.get('setting.delay'))
        vars.actionPending = false
        vars.actionCount = 0
        $(".closeModal").click()
    }

    function prepareEvents() {
        $(document).on('click', '.bot-menu-nav', function(event) {
            $('#bot-wrapper .panes').hide()
            let target = $(this).attr('data-target')
            $('#' + target).show()
        })

        $('#bot-control-panel').click(event => {
            $('#modalTitle').text(`Betabot controls - Version: ${GM_info.script.version}`)
            $('#modalWrapper, #modalBackground, #bot-wrapper').show()
        })

        $('#modalBackground, .closeModal').click(event => {
            $('#bot-wrapper').hide()
        })

        $(document).on('change', '.bot-option', function(event) {
            let key = $(this).attr('data-key')
            let type = $(this).attr('data-type')
            let value = $(this).is(':checkbox') ? $(this).is(':checked') : $(this).val()

            settings.set(type + '.' + key, value)
        })

        $(document).on('change', '.tc-option', function(event) {
            setTimeout(() => trainingCenter.validateSettings(), 100)
        })

        $(document).on('click', '.bot-command', function(event) {
            let command = $(this).attr('data-command')
            if (command == 'send_ingredients') {
                command = command + '|' + settings.get('setting.main_username')
                // command = command + '|batsarmyii'
            }

            if (command == 'army_event')
                chat.sendEventChannel('InitEvent')
            else 
                chat.sendAltChannel('command|' + command)
        })

        $(document).on('click', '.tc-switch', function(event) {
            let command = $(this).attr('data-command')
            trainingCenter.switch(command)
        })

        $(document).on('click', '.tc-train', function(event) {
            let command = $(this).attr('data-command')
            if (command == 'current')
                trainingCenter.trainCurrentAction()
            else
                trainingCenter.train(command)
        })

        $(document).on('click', '.bot-override', function(event) {
            let key = $(this).attr('data-key')
            let type = $(this).attr('data-type')
            let value = $(this).attr('data-value')
            chat.sendAltChannel('override|' + type + ':' + key + ':' + value)
        })

        $(document).on('click', '#bot-override-custom-button', function(event) {
            let type = $('#bot-override-custom-key').val()
            let value = $('#bot-override-custom-value').val()

            chat.sendAltChannel('override|' + type + ':' + value)
            $('#bot-override-custom-key').val('')
            $('#bot-override-custom-value').val('')
        })

        $(document).on('click', '.bot-currency-button', function(event) {
            let currency = []
            let to = settings.get('setting.main_username')
            $('input.bot-currency').each(function(i) {
                if ($(this).is(':checkbox') && $(this).is(':checked')) {
                    currency.push($(this).attr('data-key'))
                    $(this).click() // Reset it?
                }
                if ($(this).attr('data-key') == 'name' && $(this).val().trim() !== '') {
                    to = $(this).val().trim()
                    $(this).val('')
                }
            })
            chat.sendAltChannel('command|send_currency|' + to + '|' + currency.join(','))
        })

        $(document).on('click', '#spawngem_submit', function(event) {
            let primary = $('#spawngem_primary').val()
            let secondary = $('#spawngem_secondary').val()
            let level = parseInt($('#spawngem_level').val()) / 10
            let amount = parseInt($('#spawngem_amount').val())

            spawngem.addToQueue(primary, secondary, level, amount)

            $('#spawngem_primary').val('-1')
            $('#spawngem_secondary').val('-1')
            $('#spawngem_level').val('')
            $('#spawngem_amount').val('')
        })

        $(document).on('click', '#bot-chat-recheck', function(event) {
            vars.checkingChannel = true
            vars.checkingEventChannel = true
            setTimeout(channel.check, 100)
            setTimeout(channelEvent.check, 10 * 1000)
        })

        $(document).keydown(function(event) {
            switch(event.which) {
                case 27:
                    $('#confirmBox a.red').length && $('#confirmBox a.red').click()
                    break;
                case 13:
                    $('#confirmBox a.green').length && $('#confirmBox a.green').click()
                    break;
            }
        })

        $(document).on('click', '.change-farm-mob', function() {
            let a = parseInt($(this).attr('data-value'))
            let b = parseInt($('#autoSelectEnemy').val())

            $('#autoSelectEnemy').val(a + b)
        })

        $(document).on('click', '#betabot-export-settings-button', function() {
            let string = settings.export()
            $('#betabot-export-settings-input').val(string)
        })

        $(document).on('click', '#betabot-import-settings-button', function() {
            let string = $('#betabot-import-settings-input').val()
            settings.import(string)
            $('#betabot-import-settings-input').val('')
        })

        $(document).on('roa-ws:battle roa-ws:harvest roa-ws:craft roa-ws:carve', controller.checkGeneral)
        $(document).on('roa-ws:event_action', controller.checkEvent)
        $(document).on('roa-ws:craft', controller.checkCraftingQueue)
        $(document).on('roa-ws:carve', controller.checkCarvingQueue)
        $(document).on('roa-ws:message', messages.incoming)
        $(document).on('roa-ws:battle', mob_control.track)
        $(document).on('roa-ws:harvest', tools.checkTool)

        setInterval(() => {
            $('#bot-debug-vars').html(JSON.stringify(vars, false, 2))
        }, 10 * 1000)
    }

    function prepareHtml() {
        let templateControls = `
        <div class="row">
            <h4 class="col-xs-12">Controls options for this account</h4>
        </div>
        <div class="row">
            <div class="col-xs-3">Stamina Replenish</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="replenish"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Quest Completion</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="quest"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Construction</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="construction"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Construction Type</div>
            <div class="col-xs-3">
                <select class="form-control bot-option" data-type="control" data-key="construction_type">
                    <option value="quickest">Quickest</option>
                    <option value="slowest">Slowest</option>
                </select>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Harvestron</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="harvestron"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Harvestron Type</div>
            <div class="col-xs-3">
                <select class="form-control bot-option" data-type="control" data-key="harvestron_type">
                    <option value="food">Food</option>
                    <option value="wood">Wood</option>
                    <option value="iron">Iron</option>
                    <option value="stone">Stone</option>
                    <option value="lowest_level">Lowest Level</option>
                    <option value="highest_level">Highest Level</option>
                    <option value="lowest_resource">Lowest Resources</option>
                    <option value="highest_resource">Highest Resources</option>
                    <option value="round_robin">Round Robin</option>
                </select>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Crafting Queue Fill</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="crafting"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Carving Queue Fill</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="carving"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Auto Mob Movement</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="mob_control"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Do not move at night (locket)</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="mob_control_locket"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Upgrade Tool Level</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="upgrade_tool_level"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Upgrade Tool Tier</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="upgrade_tool_tier"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Construction Cleanup after level 30</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="construction_cleanup"><span class="roundedslider"></span>
                </label>
            </div>
            <label class="col-xs-3">Max Battle Level</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="control" data-key="max_level" />
            </div>
        </div>
        `

        let templateEvent = `
        <div class="row">
            <h4 class="col-xs-12">Event Settings</h4>
        </div>
        <div class="row">
            <div class="col-xs-3">Event Join</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-option" data-type="event" data-key="join"><span class="roundedslider"></span>
                </label>
            </div>
            <div class="col-xs-3">Minute to join</div>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="event" data-key="join_time" />
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Default Action</div>
            <div class="col-xs-3">
                <select class="form-control bot-option" data-type="event" data-key="base_action">
                    <option value="battle">Battle</option>
                    <option value="fishing">Fishing</option>
                    <option value="woodcutting">Woodcutting</option>
                    <option value="mining">Mining</option>
                    <option value="stonecutting">Stonecutting</option>
                    <option value="ts">Default TS</option>
                    <option value="crafting">Crafting</option>
                    <option value="carving">Carving</option>
                </select>
            </div>
            <div class="col-xs-3">Switch to battle at end of event</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-option" data-type="event" data-key="switch_to_battle"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        `

        let templateSettings = `
        <div class="row">
            <h4 class="col-xs-12">Bot Settings</h4>
        </div>
        <div class="row">
            <label class="col-xs-3">Action Delay</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="delay" />
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Carving Queue Minimum</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="carving_queue_min" />
            </div>
            <label class="col-xs-3">Crafting Queue Minimum</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="crafting_queue_min" />
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Crafting Quality</label>
            <div class="col-xs-3">
                <select class="form-control bot-option" data-type="setting" data-key="crafting_quality">
                    <option value="0">Poor</option>
                    <option value="1">Basic</option>
                    <option value="2">Standard</option>
                    <option value="3">Refined</option>
                    <option value="4">Epic</option>
                    <option value="5">Legendary</option>
                    <option value="6">Artifact</option>
                    <option value="7">Relic</option>
                </select>
            </div>
            <label class="col-xs-3">Crafting Item</label>
            <div class="col-xs-3">
                <select class="form-control bot-option" data-type="setting" data-key="crafting_item">
                    <option value="0">Sword</option>
                    <option value="1">Staff</option>
                    <option value="2">Bow</option>
                    <option value="50">Helmet</option>
                    <option value="51">Breastplate</option>
                    <option value="52">Gloves</option>
                    <option value="53">Boots</option>
                    <option value="54">Shield</option>
                    <option value="55">Quiver</option>
                </select>
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Minimum Resources</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="min_resources" />
            </div>
            <label class="col-xs-3">Minimum Crystals</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="min_crystals" />
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Bot Channel Name</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="bot_channel_name" />
            </div>
            <label class="col-xs-3">Bot Channel Password</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="bot_channel_password" />
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Event Channel Name</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="event_channel_name" />
            </div>
            <label class="col-xs-3">Event Channel Password</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="event_channel_password" />
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Main Username</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="main_username" />
            </div>
            <label class="col-xs-3">Default TS Action</label>
            <div class="col-xs-3">
                <select class="form-control bot-option" data-type="setting" data-key="default_ts">
                    <option value="fishing">Fishing</option>
                    <option value="woodcutting">Woodcutting</option>
                    <option value="mining">Mining</option>
                    <option value="stonecutting">Stonecutting</option>
                </select>
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Mob Control Count</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="mob_count" />
            </div>
            <label class="col-xs-3">Mobs To Move</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-option" data-type="setting" data-key="mobs_to_move" />
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Debug Mode</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="setting" data-key="debug"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        `

        let templateOverrides = `
        <div class="row">
            <div class="col-xs-12">
                <h4>Sets controls for alts</h4>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Harvestron</div>
            <div class="col-xs-3 btn-group">
                <button class="bot-override btn btn-danger" data-type="control" data-key="harvestron" data-value="false">Off</button>
                <button class="bot-override btn btn-success" data-type="control" data-key="harvestron" data-value="true">On</button>
            </div>
            <div class="col-xs-3">Quest Completion</div>
            <div class="col-xs-3 btn-group">
                <button class="bot-override btn btn-danger" data-type="control" data-key="quest" data-value="false">Off</button>
                <button class="bot-override btn btn-success" data-type="control" data-key="quest" data-value="true">On</button>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Construction</div>
            <div class="col-xs-3 btn-group">
                <button class="bot-override btn btn-danger" data-type="control" data-key="construction" data-value="false">Off</button>
                <button class="bot-override btn btn-success" data-type="control" data-key="construction" data-value="true">On</button>
            </div>
            <div class="col-xs-3">Run Events</div>
            <div class="col-xs-3 btn-group">
                <button class="bot-override btn btn-danger" data-type="event" data-key="join" data-value="false">Off</button>
                <button class="bot-override btn btn-success" data-type="event" data-key="join" data-value="true">On</button>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Custom Input</div>
            <div class="col-xs-9 input-group">
                <input type="text" class="form-control" id="bot-override-custom-key" placeholder="Type:Key" />
                <input type="text" class="form-control" id="bot-override-custom-value" placeholder="Value" />
                <div class="input-group-append">
                    <button class="btn btn-primary" id="bot-override-custom-button">Change</button>
                </div>
            </div>
        </div>
        `

        let templateTrainingCenter = `
        <div class="row">
            <div class="col-12">
                <h4>Current Battle Spec</h4>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-2">MS</div>
            <div class="col-xs-2"><input type="text" class="form-control bot-option tc-option" data-type="trainingcenter" data-key="percent_ms" /></div>
            <div class="col-xs-2">CHC</div>
            <div class="col-xs-2"><input type="text" class="form-control bot-option tc-option" data-type="trainingcenter" data-key="percent_chc" /></div>
            <div class="col-xs-2">CHD</div>
            <div class="col-xs-2"><input type="text" class="form-control bot-option tc-option" data-type="trainingcenter" data-key="percent_chd" /></div>
        </div>
        <div class="row">
            <div class="col-xs-2">Toughness</div>
            <div class="col-xs-2"><input type="text" class="form-control bot-option tc-option" data-type="trainingcenter" data-key="percent_tou" /></div>
            <div class="col-xs-2">CAD</div>
            <div class="col-xs-2"><input type="text" class="form-control bot-option tc-option" data-type="trainingcenter" data-key="percent_cad" /></div>
            <div class="col-xs-2">Healing Boost</div>
            <div class="col-xs-2"><input type="text" class="form-control bot-option tc-option" data-type="trainingcenter" data-key="percent_hb" /></div>
        </div>
        <div class="row">
            <div class="col-xs-4" id="training-center-ratio-message"></div>
            <div class="col-xs-4">
                <div class="btn-group">
                    <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">Switch TC to <span class="caret"></span></button>
                    <ul class="dropdown-menu">
                        <li class="tc-switch" data-command="battle"><a href="#">Battle</a></li>
                        <li class="tc-switch" data-command="crafting"><a href="#">Crafting</a></li>
                        <li class="tc-switch" data-command="carving"><a href="#">Carving</a></li>
                        <li class="tc-switch" data-command="ts"><a href="#">Default Tradeskill</a></li>
                    </ul>
                </div>
            </div>
            <div class="col-xs-4">
                <div class="btn-group">
                    <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">Train TC <span class="caret"></span></button>
                    <ul class="dropdown-menu">
                        <li class="tc-train" data-command="battle"><a href="#">Battle</a></li>
                        <li class="tc-train" data-command="crafting"><a href="#">Crafting</a></li>
                        <li class="tc-train" data-command="carving"><a href="#">Carving</a></li>
                        <li class="tc-train" data-command="ts"><a href="#">Default Tradeskill</a></li>
                    </ul>
                </div>
            </div>
        </div>
        `

        let gemOptions = ''
        spawngem.gems.forEach(gem => {
            gemOptions += `<option value="${gem.value}">${gem.name}</option>`
        })

        let templateSpawnGems = `
        <div class="row">
            <div class="col-12">
                <h4>Spawn Gems</h4>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Primary Slot</div>
            <div class="col-xs-3">
                <select class="form-control" id="spawngem_primary">
                    ${gemOptions}
                </select>
            </div>
            <div class="col-xs-3">Secondary Slot</div>
            <div class="col-xs-3">
                <select class="form-control" id="spawngem_secondary">
                    ${gemOptions}
                </select>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Gem Target Level</div>
            <div class="col-xs-3">
                <input type="text" class="form-control" id="spawngem_level" />
            </div>
            <div class="col-xs-3">How Many</div>
            <div class="col-xs-3">
                <input type="text" class="form-control" id="spawngem_amount" />
            </div>
        </div>
        <div class="row">
            <div class="col-xs-6">
                <button class="btn btn-success" id="spawngem_submit">Add To Queue</button>
            </div>
            <div class="col-xs-3">Enable Gem Spawner</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="bot-option" data-type="control" data-key="spawngems"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-12">
                <table width="100%">
                    <thead>
                        <tr>
                            <th>Primary Gem</th>
                            <th>Secondary Gem</th>
                            <th>Level / Tier</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody id="spawngem_queue"></tbody>
                </table>
            </div>
        </div>
        `

        let templateCommands = `
        <h4>Sends Commands for alts</h4>
        <div class="btn-group">
            <button class="btn btn-primary bot-command" data-command="build_one">Build Once</button>
            <div class="btn-group">
                <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">Switch Action <span class="caret"></span></button>
                <ul class="dropdown-menu">
                    <li class="bot-command" data-command="switch_action|battle"><a href="#">Battle</a></li>
                    <li class="bot-command" data-command="switch_action|fishing"><a href="#">Fishing</a></li>
                    <li class="bot-command" data-command="switch_action|woodcutting"><a href="#">Woodcutting</a></li>
                    <li class="bot-command" data-command="switch_action|mining"><a href="#">Mining</a></li>
                    <li class="bot-command" data-command="switch_action|stonecutting"><a href="#">Stonecutting</a></li>
                    <li class="bot-command" data-command="switch_action|crafting"><a href="#">Crafting</a></li>
                    <li class="bot-command" data-command="switch_action|carving"><a href="#">Carving</a></li>
                    <li class="bot-command" data-command="switch_action|ts"><a href="#">Default Tradeskill</a></li>
                </ul>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">Switch Event Action <span class="caret"></span></button>
                <ul class="dropdown-menu">
                    <li class="bot-command" data-command="switch_event_action|battle"><a href="#">Battle</a></li>
                    <li class="bot-command" data-command="switch_event_action|fishing"><a href="#">Fishing</a></li>
                    <li class="bot-command" data-command="switch_event_action|woodcutting"><a href="#">Woodcutting</a></li>
                    <li class="bot-command" data-command="switch_event_action|mining"><a href="#">Mining</a></li>
                    <li class="bot-command" data-command="switch_event_action|stonecutting"><a href="#">Stonecutting</a></li>
                    <li class="bot-command" data-command="switch_event_action|crafting"><a href="#">Crafting</a></li>
                    <li class="bot-command" data-command="switch_event_action|carving"><a href="#">Carving</a></li>
                    <li class="bot-command" data-command="switch_event_action|ts"><a href="#">Default Tradeskill</a></li>
                    <li class="bot-command" data-command="switch_event_action|default"><a href="#">Base Action</a></li>
                </ul>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">Misc Shit <span class="caret"></span></button>
                <ul class="dropdown-menu">
                    <li class="bot-command" data-command="advent_calendar"><a href="#">Advent Calendar</a></li>
                    <li class="bot-command" data-command="initial_tools"><a href="#">Buy Initial Tool Levels</a></li>
                    <li class="bot-command" data-command="scrap"><a href="#">Scrap crap</a></li>
                    <li class="bot-command" data-command="disposal"><a href="#">Set Garbage Disposal</a></li>
                    <li class="bot-command" data-command="buy_stamina"><a href="#">Buy Stamina</a></li>
                    <li class="bot-command" data-command="toggle_timers"><a href="#">Toggle Timers</a></li>
                </ul>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">Switch TC Investment <span class="caret"></span></button>
                <ul class="dropdown-menu">
                    <li class="bot-command" data-command="tc_switch|battle"><a href="#">Battle</a></li>
                    <li class="bot-command" data-command="tc_switch|crafting"><a href="#">Crafting</a></li>
                    <li class="bot-command" data-command="tc_switch|carving"><a href="#">Carving</a></li>
                    <li class="bot-command" data-command="tc_switch|ts"><a href="#">Default Tradeskill</a></li>
                </ul>
            </div>
            <div class="btn-group">
                <button class="btn btn-primary dropdown-toggle" data-toggle="dropdown">TC Invest <span class="caret"></span></button>
                <ul class="dropdown-menu">
                    <li class="bot-command" data-command="tc_train|battle"><a href="#">Battle</a></li>
                    <li class="bot-command" data-command="tc_train|crafting"><a href="#">Crafting</a></li>
                    <li class="bot-command" data-command="tc_train|carving"><a href="#">Carving</a></li>
                    <li class="bot-command" data-command="tc_train|ts"><a href="#">Default Tradeskill</a></li>
                    <li class="bot-command" data-command="tc_train|current"><a href="#">Current Action</a></li>
                </ul>
            </div>
            <button class="btn btn-primary bot-command" data-command="send_ingredients">Send Ingredients</button>
            <button class="btn btn-primary bot-command" data-command="army_event">Army Event</button>
        </div>
        `

        let templateCurrency = `
        <div class="row">
            <div class="col-xs-12">
                <h4>Send selected currency from alts</h4>
            </div>
        </div>
        <div class="row">
            <label class="col-xs-3">Send To</label>
            <div class="col-xs-3">
                <input type="text" class="form-control bot-currency" data-key="name" placeholder="Leave blank to send to main account"/>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Crystals</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="crystals"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Platinum</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="platinum"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Gold</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="gold"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Food</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="food"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Wood</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="wood"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Iron</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="iron"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Stone</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="stone"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Crafting Materials</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="crafting_materials"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3">Gem Fragments</div>
            <div class="col-xs-3">
                <label class="switch">
                    <input type="checkbox" class="form-control bot-currency" data-key="gem_fragments"><span class="roundedslider"></span>
                </label>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-3"><button class="btn btn-primary bot-currency-button">Send Currency</button></div>
        </div>
        `

        let templateDebug = `
        <pre id="bot-debug-vars"></pre>
        <pre id="bot-debug"></pre>
        `

        let templateLog = `

        `

        let templateImportExport = `
        <div class="row">
            <div class="col-xs-12">
                <h4>Import / Export Settings</h4>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-10">
                <textarea id="betabot-export-settings-input"></textarea>
            </div>
            <div class="col-xs-2">
                <button id="betabot-export-settings-button">Export</button>
            </div>
        </div>
        <div class="row">
            <div class="col-xs-10">
                <textarea id="betabot-import-settings-input"></textarea>
            </div>
            <div class="col-xs-2">
                <button id="betabot-import-settings-button">Import</button>
            </div>
        </div>
        `

        let templateFull = `
        <div id="bot-wrapper" style="display: none;">
            <div class="row">
                <div class="col-xs-12">
                    <div class="btn-group">
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-controls">Controls</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-event">Event Settings</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-settings">Settings</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-overrides">Overrides</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-spawn-gems">Spawn Gems</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-commands">Commands</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-currency">Send Currency</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-trainingcenter">Training Center</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-debug">Debug</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-log">Log</button>
                        <button class="btn btn-primary bot-menu-nav" data-target="bot-menu-import-export">Import/Export Settings</button>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-12">
                    <div id="bot-menu-controls" class="panes">${templateControls}</div>
                    <div id="bot-menu-event" class="panes" style="display: none;">${templateEvent}</div>
                    <div id="bot-menu-settings" class="panes" style="display: none;">${templateSettings}</div>
                    <div id="bot-menu-overrides" class="panes" style="display: none;">${templateOverrides}</div>
                    <div id="bot-menu-spawn-gems" class="panes" style="display: none;">${templateSpawnGems}</div>
                    <div id="bot-menu-commands" class="panes" style="display: none;">${templateCommands}</div>
                    <div id="bot-menu-currency" class="panes" style="display: none;">${templateCurrency}</div>
                    <div id="bot-menu-trainingcenter" class="panes" style="display: none;">${templateTrainingCenter}</div>
                    <div id="bot-menu-debug" class="panes" style="display: none;">${templateDebug}</div>
                    <div id="bot-menu-log" class="panes" style="display: none;">${templateLog}</div>
                    <div id="bot-menu-import-export" class="panes" style="display: none;">${templateImportExport}</div>
                </div>
            </div>
            <div class="row">
                <div class="col-xs-12">
                    <button class="btn btn-primary" id="bot-chat-recheck">Recheck chat channel</button>
                </div>
            </div>
        </div>
        `
        $('#modalContent').append(templateFull)
        $('#helpSection').append('<li id="bot-control-panel"><a>Betabot</a></li>')

        $(`<button class="change-farm-mob" data-value="55">+5</button>
            <button class="change-farm-mob" data-value="110">+10</button>
            <button class="change-farm-mob" data-value="165">+15</button>
            <button class="change-farm-mob" data-value="550">+50</button>
            <button class="change-farm-mob" data-value="1100">+100</button>
            <button class="change-farm-mob" data-value="2750">+250</button>`)
            .insertAfter('#autoSelectEnemy')

        $(`<button class="change-farm-mob" data-value="-55">-5</button>
            <button class="change-farm-mob" data-value="-110">-10</button>
            <button class="change-farm-mob" data-value="-165">-15</button>
            <button class="change-farm-mob" data-value="-550">-50</button>`)
            .insertBefore('#autoSelectEnemy')

        $('body').prepend('<span id="my-fake-tc-div"></span><span id="my-fake-tc-div-2"></span>')

        settings.debug()
    }

    function setOptions() {
        _.forOwn(settings.values, (value, key) => {
            _.forOwn(value, (value2, key2) => {
                setOption(key, key2, value2)
            })
        })
    }

    function setOption(type, key, value) {
        switch(typeof value) {
            case 'boolean':
                $('.bot-option[data-type="' + type + '"][data-key="' + key + '"]').prop('checked', value)
                break;

            case 'string':
                $('.bot-option[data-type="' + type + '"][data-key="' + key + '"]').val(value)
                break;
        }
    }

    function checkIfAlt() {
        vars.isAlt = vars.username != settings.get('setting.main_username').trim().toLowerCase()
    }

    function romanize(num) {
        if (isNaN(num))
            return NaN

        let digits = String(+num).split(""),
            key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
                   "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
                   "","I","II","III","IV","V","VI","VII","VIII","IX"],
            roman = "",
            i = 3

        while (i--)
            roman = (key[+digits.pop() + (i * 10)] || "") + roman

        return (Array(+digits.join("") + 1).join("M") + roman).toLowerCase()
    }

    function getInt(text) {
        return parseInt(text.replace(/,/g, ''))
    }

    function getCurrency(type, sendable = false) {
        let attr = sendable ? 'data-personal' : 'title'
        switch(type) {
            case 'gold':
                return getInt($("td.mygold").attr(attr))
                break;
            case 'platinum':
                return getInt($("td.myplatinum").attr(attr))
                break;
            case 'crystals':
                return getInt($("td.mypremium").attr(attr))
                break;
            case 'gem_fragments':
                return getInt($("td.mygem_fragments").attr(attr))
                break;
            case 'crafting_materials':
                return getInt($("td.mycrafting_materials").attr(attr))
                break;
            case 'food':
                return getInt($("td.myfood").attr(attr))
                break;
            case 'wood':
                return getInt($("td.mywood").attr(attr))
                break;
            case 'iron':
                return getInt($("td.myiron").attr(attr))
                break;
            case 'stone':
                return getInt($("td.mystone").attr(attr))
                break;
        }
        return 0
    }

    function log(type, text) {
        let date = new Date()
        let time = ("0" + date.getHours()).slice(-2) + ':' + ("0" + date.getMinutes()).slice(-2) + ':' + ("0" + date.getSeconds()).slice(-2)

        if (type === true) {
            type = 'Debug'
            if (!settings.get('setting.debug')) return
        }

        logs.push({
            time,
            type,
            text
        })

        $("#bot-menu-log").prepend(`<div>[${time}] ${type} : ${text}</div>`)

        if (logs.length > 50) {
            $("#bot-menu-log div").last().remove()
            logs.shift()
        }
    }

    async function click(identifier) {
        await sleep(settings.get('setting.delay'))
        $(identifier).click()
    }

    function isNight() {
        let hour = moment().tz('Atlantic/Reykjavik').get('hour')
        return (hour >= 20 || hour <= 5)
    }

    function constructionQueueFix() {
        if ($('#confirmOverlay').is(':visible') && $('#confirmBox p').text().includes('Your workers are currently')) {
            $('#confirmButtons .red').click()
        }
    }

    function openHouseRoom(room, item) {
        $('#modal2Content').append(`<div id="tmp" style="display: none;"><a class="houseViewRoomItem" data-roomtype="${room}" data-itemtype="${item}">Temp</a></div>`)
        $('#tmp a').click()
        $('#tmp').remove()
    }

    settings.load()
    channel.setId(settings.get('readonly.alt_room_id'))
    channelEvent.setId(settings.get('readonly.event_room_id'))
    checkIfAlt()
    prepareHtml() // Adds the bot controls to model and link to open it
    setOptions() // Sets all the checkboxes/select menus to the saved values
    prepareEvents() // Sets all jquery events for watching settings changes and opening the menu
    setTimeout(trainingCenter.validateSettings, 500) // Set validation message for training center ratio

    setTimeout(channel.check, 15 * 1000)
    setTimeout(channelEvent.check, 30 * 1000)
    setInterval(constructionQueueFix, 5000)

    window['BETA_BOT'] = {
        crafting,
        spawngem
    }

    setInterval(() => $('li[id="websocket_reconnect_line"]').each(function() { $(this).remove()}), 3 * 1000)

})(jQuery)
