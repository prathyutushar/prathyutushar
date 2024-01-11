import { LightningElement, api, wire, track } from 'lwc';
import { gql, graphql, refreshGraphQL } from 'lightning/uiGraphQLApi';
import { updateRecord } from "lightning/uiRecordApi";
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

import CONTACT_OBJECT from '@salesforce/schema/Contact';
import GENDER_FIELD from '@salesforce/schema/Contact.GenderIdentity';

const columns = [
    { label: 'Name', fieldName: 'Name', editable: false },
    { label: 'First Name', fieldName: 'FirstName', editable: true },
    { label: 'Last Name', fieldName: 'LastName', editable: true },
    { label: 'Gender', fieldName: 'GenderIdentity', type: 'picklistColumn', editable: true,
        typeAttributes: {
            placeholder: 'Choose Gender', options: { fieldName: 'pickListOptions' }, 
            value: { fieldName: 'GenderIdentity' }, // default value for picklist,
            context: { fieldName: 'Id' }
        }
    },
];

export default class LwcWithGraphQLUsingWire extends LightningElement {
    @api recordId;
    @track contacts = [];
    @track pickListOptions;
    cols = columns;
    @track draftValues = [];
    graphqlData;
    currentGenderSelected;


    @wire(graphql, {
        query: gql`
            query getContacts($myrecordId: ID!) {
                uiapi {
                    query {
                        Contact (
                            where: { AccountId: { eq: $myrecordId } } 
                        ) {
                            edges {
                                node {
                                    Id
                                    Name { value }
                                    FirstName { value }
                                    LastName { value }
                                    GenderIdentity { value }
                                }
                            }
                        },
                    }
                }
            }`,
        variables: '$myVariables',
        operationName: 'getContacts'
    }) queryResult(result) {
        const { data, errors } = result;
        if (data) {
            console.log("Result: ", JSON.stringify(data));
            this.contacts = data.uiapi.query.Contact.edges.map((edge) => ({
                Id: edge.node.Id,
                Name: edge.node.Name.value,
                FirstName: edge.node.FirstName.value,
                LastName: edge.node.LastName.value,
                GenderIdentity: edge.node.GenderIdentity.value,
            }));
            
        } else if (errors) {
            console.log("Errors: ", JSON.stringify(errors));
        }
        this.contacts.forEach(con => {
            con.pickListOptions = this.pickListOptions;
        })
        console.log("Contacts: ", JSON.stringify(this.contacts));
        this.graphqlData = result;
    }

    get myVariables() {
        return {
            myrecordId: this.recordId
        };
    }

    @wire(getObjectInfo, { objectApiName: CONTACT_OBJECT })
    objectInfo;
 
    //fetch picklist options
    @wire(getPicklistValues, {
        recordTypeId: "$objectInfo.data.defaultRecordTypeId",
        fieldApiName: GENDER_FIELD
    })wirePickList({ error, data }) {
        if (data) {
            this.pickListOptions = data.values;
            this.contacts.forEach(con => {
                con.pickListOptions = this.pickListOptions;
            })
        } else if (error) {
            console.log(error);
        }
    }

    

    async handleSave(event) {
        debugger;
        console.log("draftValues: ", JSON.stringify(event.detail.draftValues.slice()));


        // Convert datatable draft values into record objects
        const records = event.detail.draftValues.map((draftValue) => {
            const fields = Object.assign({}, draftValue);
            console.log("fields", fields);
            return { fields };
        });
    

        // Clear all datatable draft values
        this.draftValues = [];
        try {
            // Update all records in parallel thanks to the UI API
            const recordUpdatePromises = records.map((record) => updateRecord(record));
            await Promise.all(recordUpdatePromises).then(() => {
                console.log('Success');
            }).catch(error => {
                console.log("error: ", JSON.stringify(error));
            });
    
            // Report success with a toast
            this.dispatchEvent(
                new ShowToastEvent({
                    title: "Success",
                    message: "Contacts updated",
                    variant: "success",
                }),
            );
    
            // Display fresh data in the datatable
            await refreshGraphQL();
        } catch (error) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: "Error updating or reloading contacts",
                    message: error.body.message,
                    variant: "error",
                }),
            );
        }
    }

    async refreshGraphQL() {
        return refreshGraphQL(this.graphqlData);
    }

    handleCellChange(event) {
        let draftValue = event.detail.draftValues[0].GenderIdentity;
        console.log('Event.detail', draftValue);
        //draftValues.forEach(ele=>{
        //    this.updateDraftValues(ele);
        //})
    }
    
}