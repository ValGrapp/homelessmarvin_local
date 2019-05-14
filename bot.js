// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.


//Grundlagen: Verschiedene Prompttypen für Dialogbot werden geladen 
const { ActivityHandler, ActionTypes, ActivityTypes, CardFactory } = require('botbuilder');
//Benötigt, um Bilder senden zu können (auch Cardfactory) :) 
const path = require('path');
const axios = require('axios');
const fs = require('fs');
// this loads the additional libraries to create dialog-contexts
const { DialogSet, ChoicePrompt, NumberPrompt, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

//Speichereinheiten, um Aussagen aus den Dialogen zu speichern 
// define constant Strings to access different memory-states
const DIALOG_STATE_PROPERTY = 'dialogState';
const USER_PROFILE_PROPERTY = 'user';


//Name der (Wasserfall-)Dialoge  
// define constant Strings to distinguish different dialog-prompts
const WHO_ARE_YOU = 'who_are_you';
const HELLO_USER = 'hello_user';
const SLEEP = 'sleep';
const MONEY = 'money';
const DONTKNOW = 'dontknow';
const TIPING = 'tiping';
//Name der "Prompts" (also Fragen) die nach denen der Bot während "WHO_ARE_YOU" fragen wird
const NAME_PROMPT = 'name_prompt';
const CONFIRM_PROMPT = 'confirm_prompt';
const SLEEP_PROMPT = 'sleep_prompt';
const MONEY_PROMPT = 'money_prompt';
const DONTKNOW_PROMPT = 'dontknow_prompt';
// just a constant string to access the user values
const USER_INFO = 'user_info';

/**
 * We will use compromise NLP library for text-matching.
 * http://compromise.cool
 */
const nlp = require('compromise');

class MyBot {
    /**
     * In the constructor we will create and register the different dialog-prompts used in the bot.
     * 
     * @param {ConversationState} conversationState A ConversationState object used to store the dialog state.
     * @param {UserState} userState A UserState object used to store values specific to the user.
     */

//Konstruktion
constructor(conversationState, userState) {
        // Create a new state accessor property. See https://aka.ms/about-bot-state-accessors to learn more about bot state and state accessors.
        this.conversationState = conversationState;
        this.userState = userState;

        // create accessor for the conversation state. This enables us to capture and store conversation specific properties.
        // Also create an accessor for userProfile. This enables us to capture and store user-specific properties.
        // For more info either see here: https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-howto-v4-state?view=azure-bot-service-4.0&tabs=javascript
        this.dialogState = this.conversationState.createProperty(DIALOG_STATE_PROPERTY);
        this.userProfile = this.userState.createProperty(USER_PROFILE_PROPERTY);
        this.dialogs = new DialogSet(this.dialogState);

//Prompts werden definiert
        // Add prompts that will be used by the main dialogs.
        this.dialogs.add(new TextPrompt(NAME_PROMPT));
        this.dialogs.add(new ChoicePrompt(CONFIRM_PROMPT));
        this.dialogs.add(new ChoicePrompt(SLEEP_PROMPT));
        this.dialogs.add(new ChoicePrompt(MONEY_PROMPT));
        this.dialogs.add(new ChoicePrompt(DONTKNOW_PROMPT));
        //Age-Prompt mit Validation step: Prüft, ob die Alterangabe auch größer als 0 ist --> nicht so wichtig! 
        // this prompt adds an additional validation-step

//1. Dialog! WHO_ARE_YOU
// A waterfall dialog is a top-down dialog consisting of several dialogs building upon each other
        this.dialogs.add(new WaterfallDialog(WHO_ARE_YOU, [
        // each of those entries bind to local functions
        this.promptForName.bind(this),
        this.confirmPrompt1.bind(this),
        this.info.bind(this)
        ]));
//2. Dialog! HELLO_USER
// Create a dialog that displays a user name after it has been collected.
        this.dialogs.add(new WaterfallDialog(HELLO_USER, [
        this.displayProfile.bind(this),
        ]));
//3. Dialog! SLEEP
        this.dialogs.add(new WaterfallDialog(SLEEP, [
        this.askforsleep.bind(this),
        this.askforpic.bind(this),
        ]));
//4. Dialog! MONEY
        this.dialogs.add(new WaterfallDialog(MONEY, [
        this.askformoneyinfo.bind(this),
        this.askforbehavior.bind(this),
        ]));
//4. Dialog! DONTKNOW --> Wenn Bot die Frage nich kennt
        this.dialogs.add(new WaterfallDialog(DONTKNOW, [
        this.dontknow.bind(this),
        this.dontknowoption.bind(this),
        ]));

//5. Dialog! TIPING
        this.dialogs.add(new WaterfallDialog(TIPING, [
        this.tiping.bind(this),
        ]));
}

//Dialoge werden definiert 
//Dialog HELLO_USER
//Prompt bedeutet, nach einer Info zu fragen! Hier frägt er nach dem Namen! 
    // This step in the dialog prompts the user for their name.

    async promptForName(step) {
        // create new object to store the user_info into
        step.values[USER_INFO] = {};
//Tippen und Vorstellung
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1500}
        ])
        await step.context.sendActivity(`Hi! Im Marvin :) Happy that you are interested in my story :)`);
//Bild senden
        await step.context.sendActivities([
        {type: 'typing'},
        {type: 'delay', value: 1000}
        ])
        const reply = { type: ActivityTypes.Message };
        // reply.text = 'This is an attachment.';
        reply.attachments = [this.getInternetAttachment()];
        await step.context.sendActivity(reply);
//Tippen und nach Namen fragen 
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1500}
        ])
        return await step.prompt(NAME_PROMPT, `Whats your name buddy?`);
    }

//Name des Users wird gespeichert 
    async confirmPrompt1(step) {
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        step.values[USER_INFO].name = step.result;
        await step.context.sendActivity(`Nice to meet you ${step.result}!`);
//Es wird gefragt, ob man das Alter geben will 
        await step.context.sendActivities([
        {type: 'typing'},
        {type: 'delay', value: 1000}
        ])
        await step.prompt(CONFIRM_PROMPT, 'Since you are here, I quess you wanna hear something bout my story right? What do you wanna know?', ['about you', 'living on the street']);
    }

// This step checks the user's response 
    async info(step) {
        if (step.result && step.result.value === 'about you') {
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1000}
                ])
            await step.context.sendActivity(`Alright!`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1000}
                ])
            await step.context.sendActivity(`I’m 39 years young and of course I wasn't homeless my whole life.`);
            await step.context.sendActivity(`I used to work in bakery that went broke..`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`And I have a 9 year old daughter, Emma.`);
            await step.context.sendActivity(`She is my greatest motivation to get my life into places again.`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`What else you wanna know? :)`);
        } else {
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`Puh .. where should I start.`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`Of course living outside is hard..`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`Most important thing is not being alone and having people around you`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`I’m glad to have some good friends on the street.`);
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1500}
                ])
            await step.context.sendActivity(`And my dog of course!`);
            await step.context.sendActivity(`What else you wanna know? :)`);
            // return await step.next(-1);
        }
//Speichern des Namens, um später nochmal drauf zugreifen zu können :) 
         // First: Get the state properties from the turn context.
         const user = await this.userProfile.get(step.context, {});
         // then copy the properties directly from the dialog-object
         user.name = step.values[USER_INFO].name;
        //store it back into the userProfile-memory
        await this.userProfile.set(step.context, user);
//Ende des Dialogs 
        return await step.endDialog();
    }

//Dialog WHO_ARE_YOU
    // This step displays the captured information back to the user.
    async displayProfile(step) {
        // // Get the state properties from the turn context.
        const user = await this.userProfile.get(step.context, {});
            await step.context.sendActivity(`Your name is ${user.name}.`);
            return await step.endDialog();
    }

//Dialog SLEEP
    async askforsleep(step) {
        // // Get the state properties from the turn context.
        const user = await this.userProfile.get(step.context, {});
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1500}
            ])
        await step.context.sendActivity(`It’s not raining I’will sleep outside.`);
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        await step.prompt(SLEEP_PROMPT, 'Do you want to see how my sleeping place looks like?', ['Sure', 'No thanks']);
    }
    async askforpic(step) {
        if (step.result && step.result.value === 'Sure') {
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1000}
                ])
            const reply = { type: ActivityTypes.Message };
            // reply.text = 'This is an attachment.';
            reply.attachments = [this.sleeppic()];
            await step.context.sendActivity(reply);
        } else {
            await step.context.sendActivities([
                {type: 'typing'},
                {type: 'delay', value: 1000}
                ])
            await step.context.sendActivity(`haha you are missing out!`);
        }
        return await step.endDialog();
    }

//Dialog Money
    async askformoneyinfo(step) {
        // // Get the state properties from the turn context.
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        const user = await this.userProfile.get(step.context, {});
        await step.context.sendActivity(`I go begging.`);
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        await step.prompt(MONEY_PROMPT, 'Do you give money if you see a homeless person sometimes?', ['Yes!', 'Not really']);
    }
    async askforbehavior(step) {
        if (step.result && step.result.value === 'Yes!') {
        await step.context.sendActivities([
        {type: 'typing'},
        {type: 'delay', value: 1000}
        ])
        await step.context.sendActivity(`Oh cool! Thanks a lot in the name of all my friends!`);
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        await step.context.sendActivity(`But you know, if you don’t want to give money, a kind word is also enough to make my day.`);
        } else {
        await step.context.sendActivities([
        {type: 'typing'},
        {type: 'delay', value: 1000}
        ])
        await step.context.sendActivity(`Is there a reason for that? `);
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        await step.context.sendActivity(`But you know, if you don’t want to give money, a kind word is also enough to make my day.`);
        }
        return await step.endDialog();
    }

//Dialog Dontknow
    async dontknow(step) {
        // Get the state properties from the turn context.
        const user = await this.userProfile.get(step.context, {});
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        await step.context.sendActivity(`I actually dont really know what to say ...`);
        await step.context.sendActivities([
            {type: 'typing'},
            {type: 'delay', value: 1000}
            ])
        await step.prompt(DONTKNOW_PROMPT, 'Maybe you wanna talk about something else?', ['dreams', 'routine']);
    }
    async dontknowoption(step) {
        if (step.result && step.result.value === 'dreams') {
        return await step.endDialog();
        } else {
        return await step.endDialog();
        }
    }

//Dialog TIPING
async tiping(step) {
    await step.context.sendActivities([
        {type: 'typing'},
        {type: 'delay', value: 1000}
        ])
    return await step.endDialog();
}

/**
* This function is called on each message or activity received from a user.
* 
* @param {TurnContext} turnContext A TurnContext object that will be interpreted and acted upon by the bot.
*/
async onTurn(turnContext) {


//Error/cancel Funktion!
    // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
    if (turnContext.activity.type === ActivityTypes.Message) {
        // Create a dialog context object.
        const dc = await this.dialogs.createContext(turnContext);
        // preprocess the text-input from the user
        const utterance = nlp(turnContext.activity.text);
        // check for utterance 
                    if (utterance.has('cancel')) {
                        // check if there is currently an active dialog running
                        if (dc.activeDialog) {
                            await dc.cancelAllDialogs();
                            await dc.context.sendActivity(`Ok... canceled.`);
                        } else {
                            await dc.context.sendActivity(`Nothing to cancel.`);
                        }
                    }                  
    
//Hier können Dialoge und Fragen getriggert werden 
        // If the bot has not yet responded, continue processing the current dialog.
        // this will 
await dc.continueDialog();
// On any input start the sample dialog if not already started
if (!turnContext.responded) {
const user = await this.userProfile.get(dc.context, {});
//Dialoge Triggern
// if we already completed the dialog to get user-input, return the info
    if (utterance.has("(hello|hi|hey)")) {
    await dc.beginDialog(WHO_ARE_YOU);
            // otherwise start the dialog
    } 
    //has = beinhaltet
    //Vor start kann auch noch /start stehen! Das Wort kann nach hinten oder vorne verändern werden :)
    //muss nur an einer Stelle start enthalten 
    // /start benötigen wir, weil Telegram damit den Chat beginnt ..
    else if (utterance.has('start')) {
        await dc.beginDialog(WHO_ARE_YOU);
    } 
    //Funktioniert nicht ... sollte /start erkennen --> regular und unregular expressions!
    //The forward slashes are not a part of the expression itself, but denote the beginning and ending of the expression.
    // else if (utterance.has('\/start')) {
    //     await dc.beginDialog(WHO_ARE_YOU);
    // } 
    // else if (utterance.has('/g\(\)/')) { //funktioniert halb, reagiert auch nur auf "g", sollte aber auf g() regaieren
    //     await dc.beginDialog(WHO_ARE_YOU);
    // } 
    else if (utterance.has('name')) {
    await dc.beginDialog(HELLO_USER);
    } 
    else if (utterance.has('sleep')) {
    await dc.beginDialog(SLEEP);
    } 
    else if (utterance.has("(money|earn)")) {
    await dc.beginDialog(MONEY);
    } 

//Fragen Triggern und Antworten
    else {
        if (turnContext.activity.type === ActivityTypes.Message) {
        var rawtext = turnContext.activity.text

        // interpret usermessage with compromise for further use
        var userMessage = nlp(rawtext);
           
            //Send a pic
            if (userMessage.has("pic")) {
            const reply = { type: ActivityTypes.Message };
            reply.attachments = [this.getInternetAttachment()];
            await step.context.sendActivity(reply);
            }


            //About you 
            if (userMessage.has("about you")) {
                await turnContext.sendActivity(`Alright!`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`I’m 39 years young and of course I wasn't homeless my whole life.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`I used to work in bakery that went broke..`);
                await turnContext.sendActivity(`At this point I had a really hard time and didn’t get my life in line.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`And I have a 9 year old daughter, Emma.`);
                await turnContext.sendActivity(`She is my greatest motivation to get my life into places again.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`Ask me anything!`);
            }
            //Living on the street
            else if (userMessage.has("living on the street")) {
            await dc.beginDialog(TIPING);
            await turnContext.sendActivity(`Puh .. where should I start.`);
            await dc.beginDialog(TIPING);
            await turnContext.sendActivity(`Of course living outside is hard..`);
            await dc.beginDialog(TIPING);
            await turnContext.sendActivity(`Most important thing is not being alone and having people around you`);
            await dc.beginDialog(TIPING);
            await turnContext.sendActivity(`I’m glad to have some good friends on the street.`);
            await dc.beginDialog(TIPING);
            await turnContext.sendActivity(`And my dog of course!`);
            await dc.beginDialog(TIPING);
            await turnContext.sendActivity(`Ask me anything!`);
            }
            // mood
            else if (userMessage.has("how are you")) {
                await turnContext.sendActivity(`All good! Thanks! Hope you too!`);
            }
            else if (userMessage.has("^(how|hows|how's) *? (doing|do|been|it|everything)")) {
                await turnContext.sendActivity(`All good! Thanks! Hope you too!`);
            }
            // life crisis
            else if(userMessage.has("^what happend *? time")) {
                await turnContext.sendActivity(`A few weeks after I lost my job, my girlfriend broke up and I wasn’t able to see my daughter.`);
                await turnContext.sendActivity(`At this time I was busy with myself, didn’t get my hands on the paperwork, couldn’t pay the rent anymore and then things went really fast.`);
            }
            else if(userMessage.has("^what happend")) {
                await turnContext.sendActivity(`A few weeks after I lost my job, my girlfriend broke up and I wasn’t able to see my daughter.`);
                await turnContext.sendActivity(`At this time I was busy with myself, didn’t get my hands on the paperwork, couldn’t pay the rent anymore and then things went really fast.`);
            }
            else if(userMessage.has("^(what|why|whats) *? (homeless|street)")) {
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`A few weeks after I lost my job, my girlfriend broke up and I wasn’t able to see my daughter.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`At this time I was busy with myself, didn’t get my hands on the paperwork, couldn’t pay the rent anymore and then things went really fast.`);
            }
            else if(userMessage.has("crisis")) {
                await turnContext.sendActivity(`A few weeks after I lost my job, my girlfriend broke up and I wasn’t able to see my daughter.`);
                await turnContext.sendActivity(`At this time I was busy with myself, didn’t get my hands on the paperwork, couldn’t pay the rent anymore and then things went really fast.`);
            }
            // homeless shelters
            else if(userMessage.has("^why *? live *? street")) {
                await turnContext.sendActivity(`The conditions of most shelters are inhuman.`);
                await turnContext.sendActivity(`People are drunk, they snore, it’s loud and the light goes on and off.`);
                await turnContext.sendActivity(`It’s a place where I don’t want to stay.`);
            }
            else if(userMessage.has("(shelter|house|apartment|dwelling)")) {
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`The conditions of most shelters are inhuman.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`People are drunk, they snore, it’s loud and the light goes on and off.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`It’s a place where I don’t want to stay.`);
            }
            else if(userMessage.has("^(where) *? (live|sleep|stay)")) {
                await turnContext.sendActivity(`The conditions of most shelters are inhuman.`);
                await turnContext.sendActivity(`People are drunk, they snore, it’s loud and the light goes on and off.`);
                await turnContext.sendActivity(`It’s a place where I don’t want to stay.`);
            }
            // plans
            else if(userMessage.has("(plan|plans|dream|dreams|wish|hopes)")) {
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`I don’t want to live on the street anymore but it’s difficult to get a job.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`I’d love to work again and live in my own apartment and see my daughter again.`);
            }
            // plans
            else if(userMessage.has("^(what|do) *? (plan|plans|dream|dreams|wish|hopes)")) {
                await turnContext.sendActivity(`I don’t want to live on the street anymore but it’s difficult to get a job.`);
                await turnContext.sendActivity(`I’d love to work again and live in my own apartment and see my daughter again.`);
            }
            // emotions
            else if(userMessage.has("^(are|what|do) *? (disappointed|sad)")) {
                await turnContext.sendActivity(`I had a normal life and when I remember I get sad how things went. But now I have to make the best out if it`);
            }
            // family
            else if(userMessage.has("(family|kid|Emma|emma|child|daughter)")) {
                await turnContext.sendActivity(`I haven’t seen Emma since I am living on the street. I think of her every day.`);
            }
            //support
            else if(userMessage.has("^(how|what) *? (give|support|help)")) {
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`I'm thankful for almost everything. Money, food, cigaretts`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`But it’s the greatest gift if people are kind and still see me as a human being.`);
            }
            // daily life
            else if(userMessage.has("^(what|how|do) *? daily? (day|life|everyday|normal|routine)")) {
                await turnContext.sendActivity(`I live without time, because I don’t have a watch or smartphone.`);
                await turnContext.sendActivity(`When I wake up I go to the railway mission to get free coffee. I spend my days on the streets, getting food`);
                await turnContext.sendActivity(`In the evening looking for a place to sleep.`);
            }
            else if(userMessage.has("(day|life|everyday|normal|routine)")) {
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`I live without time, because I don’t have a watch or smartphone.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`When I wake up I go to the railway mission to get free coffee. I spend my days on the streets, getting food`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`In the evening looking for a place to sleep.`);
            }
            // winter
            else if(userMessage.has("^(where|what) *? (do|stay|sleep|live) * winter")) {
                await turnContext.sendActivity(`I hate winters, they are the worst. The nights are freaking cold and you get less sleep.`); 
                await turnContext.sendActivity(`A nice guy gave me a warm sleeping back. Without that I couldnt survive outside. I’m very thankful for that.`); 
            }
            // period time
            else if(userMessage.has("^(since|how) *? (are|live|life) * (street|homelesse)")) {
                await turnContext.sendActivity(`6 years`);
            }
            // money
            else if(userMessage.has("spend money")) {
                await turnContext.sendActivity(`I buy food, mostly fresh fruits cause you usually don’t get that at the Tafel. But money is rare.`);
                await turnContext.sendActivity(`But money is rare.`);
            }
            else if(userMessage.has("^what *? buy")) {
                await turnContext.sendActivity(`I buy food, mostly fresh fruits cause you usually don’t get that at the Tafel. But money is rare.`);
                await turnContext.sendActivity(`But money is rare.`);
            }
            // hygiene
            else if(userMessage.has("(smell|stink)")) {
                await turnContext.sendActivity(`It’s not the people, it’s the clothes that smell.`);
                await turnContext.sendActivity(`I use public toilets but it costs.`);
            }
            // food
            else if(userMessage.has("^(what|how|do) *? (eat|food|foods|breakfast|lunch|dinner|groceries)")) {
                await turnContext.sendActivity(`I wont’t starve.`);
                await turnContext.sendActivity(`There are a bunch of places where I get food.`);
            }
            //alcohol
            else if(userMessage.has("^(do|what) *? (alcohol|drugs)")) {
                await turnContext.sendActivity(`I keep away from alcohol and drugs.`);
                await turnContext.sendActivity(`I know too many people that are addicted and lost control.`);
            }
            //clothing
            else if(userMessage.has("(do|what) *? (clothes|clothing|wear)")) {
                await turnContext.sendActivity(`I have two pair of clothes. Once in month I’m able to wash them.`);
            }

            //Verabschiedung
            else if (userMessage.has("(bye|byebye)")) {
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`Time went so fast talking to you.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`It was a pleasure!`);
                await turnContext.sendActivity(`Its also time for me to move on.`);
                await dc.beginDialog(TIPING);
                await turnContext.sendActivity(`Maybe think of me sometimes! I will also.`);
                const reply = { type: ActivityTypes.Message };
                // reply.text = 'This is an attachment.';
                reply.attachments = [this.leavepic()];
                await turnContext.sendActivity(reply);
            }

            //Wenn er die Frage nicht kennt und keine Anwort hat :) 
            else {
            await dc.beginDialog(DONTKNOW);
            }
        }
        //await turnContext.sendActivity(`You said "${rawtext}"`); 
else {
// Generic handler for all other activity types.
await turnContext.sendActivity(`[${ turnContext.activity.type } event detected]`);
    }
}

//Random stuff bei Update: Erklärung was der Bot so kann
                } else if (turnContext.activity.type === ActivityTypes.ConversationUpdate) {
                    // Do we have any new members added to the conversation?
                    if (turnContext.activity.membersAdded.length !== 0) {
                        // Iterate over all new members added to the conversation
                        for (var idx in turnContext.activity.membersAdded) {
                            // Greet anyone that was not the target (recipient) of this message.
                            // Since the bot is the recipient for events from the channel,
                            // context.activity.membersAdded === context.activity.recipient.Id indicates the
                            // bot was added to the conversation, and the opposite indicates this is a user.
                            if (turnContext.activity.membersAdded[idx].id !== turnContext.activity.recipient.id) {
                                // Send a "this is what the bot does" message.
                                // const description = "I am a bot that demonstrates the TextPrompt and NumberPrompt classes " +
                                //     "to collect your name and age, then store those values in UserState for later use." +
                                //     "Say anything to continue.";
                                await turnContext.sendActivity(description);
                            }
                        }
                    }
                }


        // Save changes to the user state.
        await this.userState.saveChanges(turnContext);

        // End this turn by saving changes to the conversation state.
        await this.conversationState.saveChanges(turnContext);

    }
}


//Funktionen 
//Bilder senden von Bot an User :) 
    getInternetAttachment() {
        // NOTE: The contentUrl must be HTTPS.
        return {
            name: 'Thats me!',
            contentType: 'image/png',
            contentUrl: 'https://images.unsplash.com/photo-1517777981466-20cf0d38a6d5?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=934&q=80'
        };
    }

    sleeppic() {
        // NOTE: The contentUrl must be HTTPS.
        return {
            name: 'Its actually more cosy than it looks',
            contentType: 'image/png',
            contentUrl: 'https://cdn-images-1.medium.com/max/1600/0*dP1r9p7MiSHNxcBH'
        };
    }

    leavepic() {
        // NOTE: The contentUrl must be HTTPS.
        return {
            name: 'See ya!',
            contentType: 'image/png',
            contentUrl: 'https://lifestylefrisco.com/wp-content/uploads/2019/03/homeless-man-backpack-770x589.jpg'
        };
    }

    // getInlineAttachment() {
    //     const imageData = fs.readFileSync(path.join(__dirname, 'dog.png'));
    //     const base64Image = Buffer.from(imageData).toString('base64');

    //     return {
    //         name: 'architecture-resize.png',
    //         contentType: 'image/png',
    //         contentUrl: `data:image/png;base64,${ base64Image }`
    //     };
    // }
}


module.exports.MyBot = MyBot;