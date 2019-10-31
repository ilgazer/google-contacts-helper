function handleClientLoad() {
    let people = new People();

    window.addEventListener("message", function (event) {
        console.log(event);
        if (event.data.command) {
            people[event.data.command](...event.data.args).then((resp) => {
                event.source.postMessage({id: event.data.id, resp: resp}, "*");
            });
        }
    }, false);

}

function People() {

// Enter an API key from the Google API Console:
//   https://console.developers.google.com/apis/credentials
    let apiKey = 'AIzaSyAoCLXPMAeS6lmNHNdZSRXxSM3cA6dTwD0';

// Enter the API Discovery Docs that describes the APIs you want to
// access. In this example, we are accessing the People API, so we load
// Discovery Doc found here: https://developers.google.com/people/api/rest/
    let discoveryDocs = ["https://people.googleapis.com/$discovery/rest?version=v1"];

// Enter a client ID for a web application from the Google API Console:
//   https://console.developers.google.com/apis/credentials?project=_
// In your API Console project, add a JavaScript origin that corresponds
//   to the domain where you will be running the script.
    let clientId = '130580862882-qouk0in4b2f3q5gj0tknq78u5lf9dqh4.apps.googleusercontent.com';

// Enter one or more authorization scopes. Refer to the documentation for
// the API or https://developers.google.com/people/v1/how-tos/authorizing
// for details.
    let scopes = 'profile';

    // Load the API client and auth2 library
    gapi.load('client:auth2', initClient);


    function initClient() {
        gapi.client.init({
            apiKey: apiKey,
            discoveryDocs: discoveryDocs,
            clientId: clientId,
            scope: scopes
        }).then(function () {
            // Listen for sign-in state changes.
            gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

            // Handle the initial sign-in state.
            updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

        });
    }

    function updateSigninStatus(isSignedIn) {
        if (isSignedIn) {
            makeApiCall();
        } else {
            signIn();
        }
    }

    function signIn() {
        gapi.auth2.getAuthInstance().signIn();
    }

    function signOut() {
        gapi.auth2.getAuthInstance().signOut();
    }

// Load the API and make an API call.  Display the results on the screen.
    async function makeApiCall() {
        console.log(await getContactStore());
        console.log(await getLabelOrCreateNew("12F"));
        console.log(await getLabelOrCreateNew("13F"))
    }

    function getPersonNameOrAccountId(person) {
        if (person.names && person.names.length > 0) {
            return person.names[0].displayName;
        } else {
            return person.resourceName;
        }
    }

    async function getContactStore() {
        let contactStore = {};
        console.log("getting contact store");

        let array = await getPage();

        array.forEach(person => contactStore[getPersonNameOrAccountId(person)] = person);
        return contactStore;

        async function getPage(pageToken = "") {
            let response = await gapi.client.people.people.connections.list({
                'resourceName': 'people/me',
                'personFields': 'names,emailAddresses',
                'pageToken': pageToken
            });
            console.log(response);
            if (response.result.nextPageToken) {
                const nextPage = await getPage(response.result.nextPageToken);
                console.log(nextPage);
                return response.result.connections.concat(nextPage)
            }
            return response.result.connections;
        }

    }

    async function getLabelsStore() {
        let contactStore = {};
        console.log("getting label store");

        let array = await getPage();

        array.forEach(label => contactStore[label.name] = label);
        return contactStore;

        async function getPage(pageToken = "") {
            let response = await gapi.client.people.contactGroups.list({
                'pageToken': pageToken
            });
            console.log(response);
            if (response.result.nextPageToken) {
                const nextPage = await getPage(response.result.nextPageToken);
                console.log(nextPage);
                return response.result.contactGroups.concat(nextPage)
            }
            return response.result.contactGroups;
        }
    }

    async function getLabelOrCreateNew(label) {
        return (await getLabelsStore())[label].resourceName ||
            ((await gapi.client.people.contactGroups.create({
                "contactGroup": {
                    "name": label
                }
            })).result.resourceName);
    }

    async function getContactsFromNameList(nameList) {
        let contacts = await getContactStore();
        return nameList
            .map(name => contacts[name])
            .filter(name => name)
            .map(contact => contact.resourceName);
    }

    async function addToLabelFromNameList(labelId, contactList) {
        await gapi.client.people.contactGroups.members.modify({
            resourceName: labelId,
            resourceNamesToAdd: contactList
        });
    }

    this.addPeopleFromNameList = (tag, nameList) =>
        Promise.all([getLabelOrCreateNew(tag), getContactsFromNameList(nameList)])
            .then(([label, contactList]) => addToLabelFromNameList(label, contactList));
}
