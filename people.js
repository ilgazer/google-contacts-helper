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
        if (!isSignedIn) {
            signIn();
        }
    }

    function signIn() {
        gapi.auth2.getAuthInstance().signIn();
    }

    function signOut() {
        gapi.auth2.getAuthInstance().signOut();
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

        let array = await getPage();

        array.forEach(person => contactStore[getPersonNameOrAccountId(person)] = person);
        return contactStore;

        async function getPage(pageToken = "") {
            let response = await gapi.client.people.people.connections.list({
                'resourceName': 'people/me',
                'personFields': 'names,emailAddresses',
                'pageToken': pageToken
            });
            if (response.result.nextPageToken) {
                const nextPage = await getPage(response.result.nextPageToken);
                return response.result.connections.concat(nextPage)
            }
            return response.result.connections;
        }

    }

    this.getAllLabels = async function () {
        let labelStore = {};

        let array = await getPage();

        array.forEach(label => labelStore[label.name] = label);
        return labelStore;

        async function getPage(pageToken = "") {
            let response = await gapi.client.people.contactGroups.list({
                'pageToken': pageToken
            });
            if (response.result.nextPageToken) {
                const nextPage = await getPage(response.result.nextPageToken);
                return response.result.contactGroups.concat(nextPage)
            }
            return response.result.contactGroups;
        }
    };

    this.getLabelFromResourceName = async function (resourceName) {
        let {result} = await gapi.client.people.contactGroups.get({
            "resourceName": resourceName,
            "maxMembers": 65531
        });
        return {
            resourceName: resourceName,
            name: result.name,
            members: await Promise.all(result.memberResourceNames.map(this.getPersonFromResourceName))
        }
    };

    this.getPersonFromResourceName = async function (resourceName) {
        const {result} = await gapi.client.people.people.get({
            "resourceName": resourceName,
            "personFields": "names,phoneNumbers"
        });
        return {
            name: result.names[0].displayName,
            resourceName: resourceName,
            phoneNumbers: (result.phoneNumbers || []).map(number => number.value)
        }
    };
    ;

    this.getLabelOrCreateNew = async function (label) {
        return ((await this.getAllLabels())[label] ||
            ((await gapi.client.people.contactGroups.create({
                "contactGroup": {
                    "name": label
                }
            })).result)).resourceName;
    };

    this.getContactsFromNameList = async function (nameList) {
        let contacts = await getContactStore();
        return nameList
            .map(name => contacts[name])
            .filter(name => name)
            .map(contact => contact.resourceName);
    };

    this.addToLabelFromContactList = function (labelId, contactList) {
        return gapi.client.people.contactGroups.members.modify({
            resourceName: labelId,
            resourceNamesToAdd: contactList
        });
    };

    //Creates new label and then adds the names in the list to it
    this.addPeopleFromNameList = (tag, nameList) =>
        Promise.all([this.getLabelOrCreateNew(tag), this.getContactsFromNameList(nameList)])
            .then(([label, contactList]) => this.addToLabelFromContactList(label, contactList));

    this.addPersonToContacts = details => {
        return gapi.client.people.people.createContact({
            "names": details.names.map(name => ({"givenName": name})),
            "phoneNumbers": details.phoneNumbers.map(number => ({"value": number})),
            "emailAddresses": details.emailAddresses.map(email => ({"value": email})),
            "memberships": details.labels.map(label => ({
                    "contactGroupMembership": {
                        "contactGroupResourceName": label
                    }
                })
            )
        })
    };

    this.addPeopleToContacts = people => Promise.all(people.map(this.addPersonToContacts));

}