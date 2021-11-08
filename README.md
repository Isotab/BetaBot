# WARNING
This script is intended for automating processes on the **BETA version** of Avabur only! If you use this script in the normal version you will likely find yourself banned as you should be. Beta is a sandbox like enviroment for testing out things and making multiple accounts and automation is accepted behaviour.

### About
This script is my personal bot for automating both my main account and my army of alts on Beta, it was never meant to be released as it is not very well done and is a bit messy but I don't have the time/patience to write out a proper one to let others use. 

This automates things such as refreshing actions, completing and starting quests, crafting/carving queue filling, building/upgrading house rooms, etc... It is meant to allow you to easily manage both the fast pace of beta and multiple accounts because that can get a bit hectic. A full list of supported features and their corresponding settings will be provided below.

### Disclaimer
This script was only ever meant to be used by me, some things will certainly be confusing and may not function as you think they should, I will try to address any of these issues as they brought up but I also have lost a bit of interest in doing this so it may just stay confusing for certain areas.

Also this readme probably has a ton of typos as I am trying to write this up real fast and my editor does not spell check markdown files


### How to install
The easiest way to use BetaBot is to install a browser Script Manager extension

 * [Tampermonkey](http://www.google.com/search?q=tampermonkey) - Chrome, Safari, Firefox, Opera
 * [Greasemonkey](http://www.google.com/search?q=greasemonkey) - Firefox, QuPZilla, ..

And then [click here](https://github.com/Isotab/BetaBot/raw/main/BetaBot.user.js) to install BetaBot

Now once you refresh the page you will have this active

### How to use
Once you have installed the userscript there will be a button added under the recent updates link to open the popup window. This window contains all controls/settings for this bot and will be the main way to interact with it. This is divided into multiple tabs and I will go through each of them below

All guides will follow a left to right, then top to bottom ordering so
------------ | -------------
Option 1 | Option 2 
Option 3 | Option 4 



### Notes
I advise setting this up on your main account first, and then using the import/export tab to copy your settings to alts so you do not have to fill out the same things multiple times.

Chat channels are checked every time you load the page to ensure they are joined, channels are created if they do not exist.

There is a persistent button across all tabs to recheck chat channel, it can be used if you change channels or are too low level on initial load to use chat

The timestamp on each command is saved by the bot so that if you reload the game those commands will not be triggered again

### Controls
This is your basic bot functionality controls for your current account. This has toggle switches to enable/disable features and a few selects/inputs for customizing how things work

* Stamina Replenish - This option just clicks the refresh button for you once you get low on stamina
* Quest Completion - This is slightly mislabeled, all quests will complete autmatically but this will start the next one
* Construction - Should the bot automatically start working on the next room/item when your timer is up
* Construction Type - This is a option to build the slowest or fastest house item
* Harvestron - Turn on/off the auto harvestron for 30 minute jobs
* Harvestron Type - This determines what rules to follow when selecting which harvestron job to send out
    * Resource options - These will focus your harveston on the specified resource
    * Highest/Lowest Level - These options will set it to choose either your highest or lowest level skill and focus on that, for lowest it will switch on level ups
    * Highest/Lowest Resource - These options will set to go based on your current (at time it runs) resource level and either focus on the one you have the most/least of
    * Round Robin - This will go down the list of available resources each turn and then start from the begining again
* Crafting Queue Fill - This will auto fill your crafting queue when you hit the threshold
* Carving Queue Fill - Same as above but for carving, will use training gems
* Auto Mob Movement - This will move mobs up/down based upon your win%, it *should* move cities just fine but some bugs may happen going back a city
* Do not move at night (locket) - This will prevent you from moving up mobs at night time when the locket is active and giving you a boost in which mobs you can kill
* Upgrade Tool Level - This will upgrade your tool level periodically if you have the gold for it
* Upgrade Tool Tier - This will upgrade your tool tier when you hit the next possible upgrade and have the crystals for it (I think that last part works but tested when I had plenty)
* Construction Cleanup after level 30 - This is a bit outdated and removes all but crystal boosts and toolkit once you hit level 30, I would advise not using it since stats are now important and I have not updated this option in a long time
* Max Battle Level - This will switch you back to your default tradeskill after you hit that level in battle, mostly used to keep alts in line with each other if you make mass gear at x level

### Event Settings
This is for auto running events, it sets up actions, limits and is a bit outdated. It was designed when carving was op and some of the options do not make much sense anymore

* Event Join - This is the toggle to switch to join **every** event or not, this will need turned off or you will be running events non stop
* Minute to join - How early/late to join events. Be a dick and join late to take advantage of the ep gainz if you must. I used this on my main only
* Default Action - Which action should you take at the start of the event (Before carving level limit)
* Fallback Action - Which action should you switch to after carving hits the max level, if you set the limit to really high you do not need to change this
* Max Carving - INTEGER ONLY!! This is the max carving level for an event before you switch actions, I set this really high by default since it is outdated

### Settings
This is the screen when you can customize the options for how the bot works, be very cautious about what you change here because this will fuck up how the bot works if you put invalid things in

* Action Delay - This is the delay between button presses for the bot, leave this at least at 1500 (1.5 seconds) to avoid spamming the server and getting the message about action too fast, and potentially acting before the game catches up and it messes up
* Carving Queue Minimum - This is the number of items you want left in your queue before you fill it up, be carefull about keeping this high with a low number of slots
* Crafting Queue Minimum - Same as above but crafting queue
* Crafting Quality - Quality to choose for auto crafting
* Crating Item - Item to auto fill your queue with
* Minimum Resources - This is the base amount of ts resources your alt accounts will keep when you use the send currency option
* Minimum Crystals - Same but for cystals
* Bot Channel Name - This is the name of the custom channel to use for controlling your alts
* Bot Channel Password - Set up a password to keep others from fucking with you!
* Event Channel Name - This is for using the event bot that has been passed around, you can join one off events with this and coordinate with others
* Event Channel Password - Find the password from someone if the default changes
* Main Username - This is the username for your main account, it is used to exempt you from overrides/commands and the default send currency user
* Default TS Action - This is used to split alts between resources, you can then use the switch to default ts command to easily force them over
* Mob Control Count - This is the minumum number of mobs to battle before deciding if you should move up/down mobs. This is ignored until current quest is complete
* Mobs To move - This is the number of mobs to move, I would advise no more than 3 until you get to the farm then switch to 11

### Overrides
This screen allows you to override any setting for your alt accounts. The basic buttons up top are the normal ones but you can change any setting using this

Custom Input - This enables you to change any setting using the specified format, to get a list of settings and the name of them go to the debug tab.

The debug tab shows you the settings in the following format

type: {
    key: value,
    key: value,
    key: value,
    key: value,
    key: value,
},
type: {
    key: value,
    key: value,
    key: value,
    key: value
}

You need to enter type:key the the top box, and then the value you want to change it to in the bottom.

This (along will all commands later shown) will use the chat channel you selected in settings to give the commands so you need to have that set up

* Toggle inputs - Use the strings "true" and "false" to change these
* Numeric inputs - For any setting that is a number just type the number in here and it will be fine
* String inputs - For settings with a text box (username, chat channel) just type in the string
* Select Inputs - For any option that uses a select box you need the actual value of the select, I would avoid these unless you are confident you can find the value

### Spawn Gems
This is for setting up a queue to auto spawn large ammounts of gems. 

Will document later

### Commands
This will send various different commands to the chat channel for your alts

* Build Once - This will open housing and build the first available item, used for early game when your alts do not have alarm clock
* Toggle Timers - This will switch the decreased timers option to get you nonuple early game, probably a waste
* Switch Action - These options will force your alts to switch to the desired action
* Switch Event Action - These options will change the default event action for all alts
* Misc Shit
    * Advent Calendar - This will open the advent calendar, use daily in december if it is active on beta
    * Buy Initial Tool Levels - This will buy the initial plastic tools for each type to get you started on alts
    * Scrap Crap - This option will scrap anything refined or below in your alts, used for early game before you make gear
    * Set Garbage Disposal - This option will set your alts garbage disposal to the highest they can auto scrap up to legendary
* Switch TC Investment - This will run /tcreset and auto invest your alts into the desired spec
* TC Investment - This will use current gold/plat to invest into the desired spec
* Send Ingredients - This will have all alts wire you ingredients, not needed since training gems and spawn gem command exist


### Send Currency
This screen will have your alts send all selected currencies to either the main account (if field is blank) or a specified user

Fill out the form and hit the send currnecy button

### Training Center
This is where you set up the ratio of how your plat is spent when using the battle tc spec. All fields must add up to 1, you will get a red/green message showing after you change something

The switch/train tc selects on here are the same as in the commands tab, but this will do it for your current account instead of for all alts

### Debug
Not really named well but this prints out the full settings object, usefull for when I make typos and am too stupid to figure out why the new setting is not working x.x Or when you want to mass change settings for your alts

The first section is a basic variable list that the bot uses, you can ignore those

The second section is your settings object, this is every control/setting that the bot uses and its current value, you can use this as a reference for the ovverride tab


The readonly set of options is just for keeping channel id's persistent across game loads, I would avoid changing those as the bot auto checks channels after each reload

### Log
A basic log I was putting in to track down issues, will mostly be empty since the debug varaible is set to false so you can ignore this

### Import/Export Settings
This is important, to avoid hassle I would advise you set up your settings tab on your main account and use this to transfer those settings to your alts. It looks kind of ugly but was last minute and I don't really care as long as it works


Export button will fill the textarea with your current settings in a copy/pastable format.

Import button will use the pasted settings to override your current settings, it will clear the box if it works. There is no message for failure but the box will not clear out