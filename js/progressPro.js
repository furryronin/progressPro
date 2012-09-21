// Progress Pro 
//
// progressive profiling script for Eloqua 10
// Copyright 2011 KPA LLC
// Written by Eli Snyder <esnyder@kpaonline.com>
//
// Licensed under the GPL, see https://github.com/jquery/jquery/blob/master/GPL-LICENSE.txt
// Progress Pro is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option) any
// later version.
// Progress Pro is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU General Public License for more details.
// You should have received a copy of the GNU General Public License along with
// Progress Pro; if not, write to the Free Software Foundation, Inc., 59 Temple
// Place, Suite 330, Boston, MA 02111-1307 USA
//
// Requires jquery and jquery.validate and additional-methods
// Pre-populates an Eloqua 10 form using data lookups, 
// 	then hides questions according to specified conditions.
// Tracks incoming channel via an optional GET parameter "ch" which is written to a field 
//	called "Channel History"
//
// Setup: you must create two data lookups in Eloqua, one to look up the email address 
//		by cookie GUID, and one to look up your other fields by email address. 
//		specify the Eloqua data lookup keys for these lookups as elqDLKey_Cookie and elqDLKey_Email
// 	as shown below
// Usage: call prePop to prepopulate the form, then as a callback function, call addChannel 
//		to do (optional) channel tracking, and call progressiveProfile to skip fields as specified
//
// Demo here: http://go.kpaonline.com/LP=26?elqCampaignId=16&ch=topliners
//
//*********************************************************************************************
//
// Example Call 
// place similar code in the <head> section of your landing page, replacing "mydomain" 
// with your domain name and "/assets/js/" with the path to your copy of this script.
// Modify the field database names, skip rules, and validation rules to suit your form
//
//	<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.6.0/jquery.min.js"></script>
//	<script type="text/javascript" src="http://ajax.aspnetcdn.com/ajax/jquery.validate/1.8/jquery.validate.min.js"></script>
//	<script type="text/javascript" src="http://ajax.aspnetcdn.com/ajax/jquery.validate/1.8/additional-methods.js"></script>
//	<script type="text/javascript" src="http://www.mydomain.com/assets/js/progressPro.js"></script>
//	<script type='text/javascript' language='JavaScript' src='http://www.mydomain.com/elqNow/elqCfg.js'></script>
//	<script type='text/javascript' language='JavaScript' src='http://www.mydomain.com/elqNow/elqImg.js'></script>
//	<script type='text/javascript' language='JavaScript' src='http://www.mydomain.com/elqNow/elqScr.js'></script>
//
//	<script type="text/javascript">
//	$(document).ready(function() {	
//		var elqDLKey_Cookie = escape('9b4bd4bf329e4f5c886a84464823313d');
//		var elqDLKey_Email = escape('beecda0cb5e04cfa93fe68127cb5cdb0');
//		var theseFields = {0: 'C_EmailAddress', 1: 'C_FirstName', 2: 'C_LastName', 3: 'C_How_did_you_hear_about_us_1', 
//						4: 'C_BusPhone', 5: 'C_Title', 6: 'C_Company', 7: 'C_State_Prov', 8: 'C_Product_Family1', 
//						9: 'C_Number_of_Employees1', 10: 'C_HR_When1', 11: 'C_EHS_when1', 13: 'C_Channel_History11'}; 
//		var openQuestions = 3;
//		var fixedQuestions = 3;
//		var thisForm = $('form').attr('id');
//		var myValidationRules = { rules: {firstName: {required: true}, lastName: {required: true}, 
//					howDidYouHearAboutUs: {required: true}, title: {required: true}, company: {required: true}, 
//					stateOrProvince: {required: true}, productFamily: {required: true}, 
//					numberOfEmployees: {required: true}, hRWhen: {required: true}, eHSWhen: {required: true}, 
//					businessPhone: { required: true, phoneUS: true }, emailAddress: { required: true, email: true } } };
//		var skipClients = {action: 'hide', depends: 3, operator: 'eq', condition: 'Client'};
//		var showAlways = {action: 'show', depends: '', operator: 'always', condition: ''};
//		var mySkipRules = {10: {1: {action: 'hide', depends: 8, operator: 'neq', condition: 'HR'}, 2: skipClients}, 
//					11: {1: {action: 'hide', depends: 8, operator: 'eq' ,condition: 'HR'}, 2: skipClients}, 
//					4: {1: skipClients}, 5: {1: skipClients}, 6: {1: skipClients}, 7: {1: skipClients}, 
//					8: {1: skipClients}, 9: {1: skipClients}, 12: {1: skipClients}};
//		prePop(theseFields, elqDLKey_Cookie, elqDLKey_Email, function(){
//			addChannel();
//			progressiveProfile(openQuestions, fixedQuestions, thisForm, theseFields, elqDLKey_Cookie, 
//										elqDLKey_Email, myValidationRules, mySkipRules);
//		});
//	});
//	</script>
//
//*********************************************************************************************


function getUrlVars()
{
//simple function to read get parameters, used for channel tracking
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function addChannel()
{
//function to append the value of the ch parameter (formatted, along with form name) 
//to a field called "Channel History" - used to track the source channel
//of a registrant, e.g. http://go.kpaonline.com/LP=26?elqCampaignId=16&ch=topliners
//records that the visitor came from Topliners
	var patt1 = /^[-_a-zA-Z0-9]+$/;
	if(getUrlVars()['ch']) var chan = getUrlVars()['ch'].match(patt1);
	if (chan != null){
		chan = $('input[name="channel-history"]').val() + $('form').attr('id') + ' ' + $('form').attr('name') + ' channel: ' + chan + ' || ';
		$('input[name="channel-history"]').val(chan);
	}
}

function popByEmail(myEmail, poparray, elqDLKey_Email, callback) {
//function to populate fields by using an Eloqua data lookup based on email address
//you must set up a data lookup by email in Eloqua and specify the lookup key
//first set up data lookup variables for email-based contact lookup 
	var n=0;
	var elqPPS = '50';
	var elqDLLookup = '<C_EmailAddress>'+myEmail+'</C_EmailAddress>';
	var elqDt = new Date();
	var elqMs = elqDt.getMilliseconds();
	var fieldval;
	if ((typeof elqCurE != 'undefined') && (typeof elqPPS != 'undefined')){
//construct URL to get Eloqua personalization script
		var lookupScript = elqCurE + '?pps=' + elqPPS + '&siteid=' + elqSiteID + '&DLKey=' + elqDLKey_Email + '&DLLookup=' + elqDLLookup + '&ms=' + elqMs;
		$.getScript(lookupScript, function() {
//once the script is loaded, populate the fields accordingly
			for (i in poparray){
				fieldval = GetElqContentPersonalizationValue(poparray[i]);
				if(fieldval != '') n++;
				$('#field' + i).val(fieldval);
			}
			if(typeof callback == 'function'){
        		callback();
      	}
			return(n);
		});
	}
	else
	{
		alert('Error: elqCurE or elqPPS undefined, include eloqua tracking scripts in head javascript');
		return(0);
	}
}

(function($) {
//jquery plugin to change enter to tab for form fields, see http://code.google.com/p/jquerytabtoselect/
    jQuery.fn.enterToTab = function() {
        return this.each(function() {
            $(this).bind('keypress', function(event) {
                if (event.keyCode == '13') {
                    event.preventDefault();
                    var list = $(":focusable");
                    list.eq(list.index(this)+1).focus().select();
                }
            });
        });
    }
    $.extend($.expr[':'], {
        focusable: function(element) {
            var nodeName = element.nodeName.toLowerCase(),
                tabIndex = $.attr(element, 'tabindex');
                return (/input|select|textarea|button|object/.test(nodeName)
                     ? !element.disabled
                    : 'a' == nodeName || 'area' == nodeName
                    ? element.href || !isNaN(tabIndex)
                    : !isNaN(tabIndex))
                    // the element and all of its ancestors must be visible
                    // the browser may report that the area is hidden
                    && !$(element)['area' == nodeName ? 'parents' : 'closest'](':hidden').length;
        }
    });
})(jQuery);

function prePop(poparray, elqDLKey_Cookie, elqDLKey_Email, callback) {
//user should call this function. poparray is an array of field ID numbers and corresponding Eloqua database field names
//prepopulate field values from a user-specified array of Eloqua field names
//first change default enter submit action to tab for all but the submit button to prevent overwriting data accidentally by pressing enter
	$('input').not('input[type="submit"]').enterToTab();
	$('select').enterToTab();
	$('textarea').enterToTab();
	var n=0;
	var elqPPS = '50';
//if the email field is prefilled, use that value for the email address
	var myEmail = $('#field0').val();
//set up default personalization function (only populates email)
	GetElqContentPersonalizationValue = function(fieldName){
		if (fieldName == 'C_EmailAddress'){
			myEmail = $('#field0').val();
			return myEmail;
		}else{
			return'';
		}
	};
	if (myEmail == '') {
//if there is no email address, try to obtain it using a data lookup based on the visitor's Eloqua tracking cookie
		if ((typeof elqCurE != 'undefined') && (typeof elqPPS != 'undefined')){
//set up data lookup variables for cookie-based visitor lookup
			var elqDLLookup = '';
			var elqDt = new Date();
			var elqMs = elqDt.getMilliseconds();
//construct URL to fetch Eloqua personalization script
			var lookupScript = elqCurE + '?pps=' + elqPPS + '&siteid=' + elqSiteID + '&DLKey=' + elqDLKey_Cookie + '&DLLookup=' + elqDLLookup + '&ms=' + elqMs;
			$.getScript(lookupScript, function() {
//once the script is loaded, set email according to cookie
  				myEmail = GetElqContentPersonalizationValue('V_Email_Address');
//prepopulate fields according to email lookup
  				n = popByEmail(myEmail, poparray, elqDLKey_Email, callback);
				return(n);
			});
		}
	}else{
//prepopulate fields according to email lookup
		n = popByEmail(myEmail, poparray, elqDLKey_Email, callback);
		return(n);
	}
}

function skipCondition(skipOption){
// evaluate whether the hide or show condition is true for an advanced skip rule
	var did = '#field' + skipOption.depends;
	switch(skipOption.operator){
//evaluate the condition according to the specified operator
	case 'eq':
		if ($(did).val() == skipOption.condition){
			return 1;
		}else{
			return 0;
		}
		break;
	case 'neq':
		if ($(did).val() != skipOption.condition){
			return 1;
		}else{
			return 0;
		}
		break;
	case 'contains':
		patt = new RegExp(skipOption.condition,'i');
		if (patt.test($(did).val())){
			return 1;
		}else{
			return 0;
		}
		break;
	case 'always':
		return 1;
		break;
	default:
//if no operator is specified, use the equals operator
		if ($(did).val() == skipOption.condition){
			return 1;
		}else{
			return 0;
		}
		break;
	}
}

function skipField(i){
//hide field number i and remove its validation rules
	$('#formElement' + i).hide();
	$('#field' + i).rules('remove');
}

function skipIfNotShown(skipOptions, i){
//hide the field unless any "show" condition exists and is true
	var showThis = 0;
	for (x in skipOptions){
		if (x == i){
			var ruleset = skipOptions[x];
			for (y in ruleset){
				if(ruleset[y].action == 'show'){
					if (skipCondition(ruleset[y])) showThis = 1;
				}
			}
		}
	}
	if(showThis){
		return 0;
	}else{
		skipField(i);
		return 1;
	}
}

function skipIfHidden(skipOptions, i){
//hide this field if it has a "hide" rule, unless there is
//a "show" rule (show rules take priority)
	var hideThis = 0;	
	for (x in skipOptions){
		if (x == i){
			var ruleset = skipOptions[x];
			for (y in ruleset){
				if(ruleset[y].action == 'hide'){
					if (skipCondition(ruleset[y])) hideThis = 1;
				}
			}
		}
	}
	if(hideThis){
		skipIfNotShown(skipOptions, i);
		return 1;
	}else{
		return 0;
	}
}

function proProgress(formId, nfields, sd, ad, skipOptions) {
	var n=0;
	//first make sure all fields are shown, then hide them.
 			for(i=0;i<nfields-1;i++){
 				 $('#formElement' + i).show();
 			}
//leave ad questions at the top even if answered and count unanswered questions
	for(i=0;i<ad;i++){
		if($('#field' + i).val()=='')n++;
	}
	for(i=ad;i<nfields-1;i++){
//for the remaining fields, if the field is prefilled, skip unless "show" condition is true
		if($('#field' + i).val()!=''){
			if(!skipIfNotShown(skipOptions, i)) n++;
		}else{
//for up to sd empty fields, only skip the field if a "hide" condition is true
			if (n < sd){
				var thisOption = 0;
				for (x in skipOptions) {
					if (x == i) {
						thisOption = 1;
					}
				}
				if(thisOption){
					if(!skipIfHidden(skipOptions, i)){
						n++;
//if this field is changed (the question is answered), show it on subsequent iterations.
//if an answered field disappears, it is confusing to the visitor, and will make them answer more questions.
						$('#field'+i).change(function(){
							var thisfieldnum = $(this).attr('id').replace('field','');
							skipOptions[thisfieldnum] = {1: {action: 'show', depends: '', operator: 'always', condition: ''}};
						});
					}
				}else{
//since this field does not have a skip option, set it to always show on subsequent iterations
					n++; 
					skipOptions[i] = {1: {action: 'show', depends: '', operator: 'always', condition: ''}};
				}
			}else{
				if(!skipIfNotShown(skipOptions, i)) n++;
			}
		}
	}
//if the form is completely filled out, auto-submit the form for convenience
//delete the following three lines to disable
	if (n == 0){ 
		$('#'+formId).submit();
	}
//delete previous three lines to disable auto-submit
	return skipOptions;
}

function progressiveProfile(sd, ad, formId, formFields, elqDLKey_Cookie, elqDLKey_Email, validationOptions, skipOptions) {
//user-called function
//arguments:
//		sd: total number of unanswered questions to ask
//		ad: questions at the top of the form to always show even if answered
//		formId: the id of the progressive profiling form
//		formFields: an array of Eloqua database field names, indexed in the order they appear on the form
//		validationOptions: array containing options for jquery validation plugin, see http://docs.jquery.com/Plugins/Validation/
//		skipOptions: optional array of advanced skip/show rules -- for each field (indexed by an integer 0 to nfields-1), specify these options:
//			action: "hide" or "show" the field if condition is true
//			depends: index of the field the value of which this rule depends on
//			operator: "eq" for equal to, "neq" for not equal to, "contains" or "always" (perform the action in all cases)
//			condition: value of "depends" field to conditionally evaluate
//				in other words, perform "action" on this field if the field "depends" (equals, does not equal, or contains) the value "condition"
//				example: {10:{action:'hide',depends:8,operator:'neq',condition:'HR'},11:{action:'hide',depends:8,operator'eq',condition:'HR'}}
//					meaning hide field 10 if field 8 is not "HR", and hide field 11 if field 8 is "HR" 
	var oldValOptions = new Array();
//deep copy validation options so they can be reset if necessary
	$.extend(true, oldValOptions, validationOptions);
//validate the form using jquery.validate according to validationOptions
	$('#' + formId).validate(validationOptions);
//count the number of fields in the form (including submit button)
	var nfields=0;
	var id='formElement0';
	for(i=0;i<100;i++){
		id = 'formElement' + i;
		if(document.getElementById(id)!=null){
			nfields++;
		}
	}
//call proProgress to skip fields as specified and set new skip options so that the same fields are shown on subsequent iterations
	skipOptions = proProgress(formId, nfields, sd, ad, skipOptions);	
//if the email changes, re-process the form
	$('#field0').change(function() {
//reset the validation options -- some rules may have been removed on previously skipped fields
		$.extend(true, validationOptions, oldValOptions);
			for (i in formFields) {
				var fieldName = $('#field' + i).attr('name');
				for (field in validationOptions.rules){
					if (field == fieldName){ 
						$('#field' + i).rules('add', validationOptions['rules'][fieldName]);
					}
				}
			}
// pre-populate the form again
		prePop(formFields, elqDLKey_Cookie, elqDLKey_Email, function(){
//re-process the form, updating the skipOptions again
			addChannel();
			skipOptions = proProgress(formId, nfields, sd-1, ad, skipOptions);
		});		
	});	
//if one of the "depends" fields in skipOptions changes, we need to re-process the form according to the new value of the field
//first determine which unique fields are specified as "depends" fields in skipOptions
	var uniqueDependFields = new Array();
	var unique = 1;
	for (m in skipOptions){
		for (n in skipOptions[m]){
			var d = skipOptions[m][n].depends;
			unique = 1;
			for(i in uniqueDependFields) {
				if (uniqueDependFields[i]==d) unique = 0;
			}
			if(unique==1 && d != '' && d != 0) uniqueDependFields.push(d);
		}
	}
//for each unique "depends" field, re-process the form if the field is changed
	for (i in uniqueDependFields){
		d = uniqueDependFields[i];
		var dfid = 'field' + d;
		$('#' + dfid).change(function() {
//reset the validation options -- some rules may have been removed on previously skipped fields
			$.extend(true, validationOptions, oldValOptions);
			for (i in formFields) {
				var fieldName = $('#field' + i).attr('name');
				for (field in validationOptions.rules){
					if (field == fieldName){ 
						$('#field' + i).rules('add', validationOptions['rules'][fieldName]);
					}
				}
			}
//continue to show the "depends" field even if other rules might hide it -- hiding it now would confuse the visitor
//determine which field just changed:
			var chNum = $(this).attr('id');
			chNum = chNum.replace('field','');
 			skipOptions[chNum] = {1: {action: 'show', depends: '', operator: 'always', condition: ''}};
//re-process the form, updating the skipOptions again
			skipOptions = proProgress(formId, nfields, sd, ad, skipOptions);		
		});
	}
}