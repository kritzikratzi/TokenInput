// We're using the JQuery-OOP approach, which... seems nice! 
(function($){

// Keep track of the number of inputs we created
var tokenInputCount = 0; 

// default this.opts
// use this to modify this.opts globally
// think twice before you do that ... :) 
var tokenInputDefaults = {
	columns: [], 
	onChange: function( objects, tokeninput ){ }, 
	onDelete: function( obj, tokeninput ){ return true; }, 
	onInsert: function( obj, tokeninput ){ return true; }, 
	onFull: function( obj, tokeninput ){}, 
	tokenText: function( obj, tokeninput ){ return obj.id }, 
	onCreate: null, // create function
	autocomplete: null, // autocomplete function
	value: null, // initial objects 
	
	multi: true, 
	duplicates: false, 
	autocompleteMaxHeight: 500, 
	
	containerClass: "tokeninput"
}; 


// Constructor
// element: The HTML element (as jQuery object) that should be turned into 
//          a token input
// opts:    Some options
function TokenInput( element, opts ){
		//
		// Let's define our object's variables
		//
		
		// Id of the future container div
		this.id = "jquery-tokeninput-" + (++tokenInputCount);
		
		// All sorts of html elements that we create
		this.elem = {}; 
		
		// Some this.opts
		this.opts = jQuery.extend( {}, tokenInputDefaults, opts );
		
		// The tokens
		this.opts.tokenObjects = []; 
		
		// Are we already autocompleteActive? Do we have any changes since the last 
		// filter request
		this.opts.autocompleteActive = false;
		this.opts.autocompleteLater = false; 
		
		// Generate the table heading
		var tableCols = ""; 
		var tableHead = ""; 
		
		for( var i = 0; i < this.opts.columns.length; i++ ){
			tableCols += "<col style='width: " + this.opts.columns[i].width + "' />"; 
			tableHead += "<th>" + this.opts.columns[i].caption + "</th>"; 
		}

		// create and insert even more html
		var inputHTML = " \
			<div id='" + this.id + "' class='" + this.opts.containerClass + "'> \
				<div class='tokens'><a class='marker insertMarker'>&#8203;</a><a class='marker positionMarker'/></div> \
				<textarea wrap='off'/> \
			</div>";
			
		var popupHTML = " \
			<div class='autocomplete'> \
				<table> \
					<colgroup>" + tableCols + "</colgroup> \
					<thead>" + tableHead + "</thead> \
				</table> \
				<div> \
					<table> \
						<colgroup>" + tableCols + "</colgroup> \
						<tbody></tbody> \
					</table> \
				</div> \
			</table> \
		"; 
		
		// store the elements 
		this.elem.container = $( inputHTML ).insertAfter( element );
		this.elem.source = element; 
		this.elem.autocompleteContainer = $( popupHTML ).appendTo( document.body );
		this.elem.autocompleteList = this.elem.autocompleteContainer.find( "tbody" ); 
		this.elem.autocomplete = this.elem.autocompleteContainer.find( "div" ); 
		this.elem.input = this.elem.container.find( "textarea" ); 
		this.elem.tokens = this.elem.container.find( "div" ); 
		this.elem.insertMarker = this.elem.container.find( "a.insertMarker" );
		this.elem.positionMarker = this.elem.container.find( "a.positionMarker" );
		
		// setup the events
		// i know it seems tempting to just write things like 
		//     this.elem.input.blur( this.handleBlur ); 
		// however, inside blur this will refer to the html element 
		// instead of this object and it's gonna confuse us and we don't 
		// like to be confused!
		var me = this;
		this.elem.input.blur( function( e ){ return me.handleBlur( e ) } ); 
		this.elem.input.focus( function( e ){ return me.handleFocus( e ) } ); 
		this.elem.input.keyup( function( e ){ return me.handleInput( e ) } ); 
		this.elem.input.keydown( function( e ){ return me.handleSpecialKeys( e ) } ); 
		this.elem.tokens.click( function( e ){ return me.elem.input.focus(); } ); 
		// Prevent form-submission with "enter" in safari
		// this.elem.input.parents( "form" ).submit( function( e ){ return !me.opts.hasFocus; }); 
		// Not necessary anymore since we switch to textareas, however, 
		this.elem.input.keypress( function( e ){ return me.handleKeyPress( e ) } );
		// Prevent transfering the focus to the scrollbar in safari
		this.elem.autocomplete.mousedown( function( e ){ return false; } ); 
		$(window).bind( 'resize', function( e ){ me.layout(); } ); 
		this.layout(); 
		
		
		// Finally ... if there are default values provided then insert them
		if( this.opts.values != null ){
			for( var i in this.opts.values ){
				// The second parameter is true to bypass the custom onInsert
				// function. 
				this.insert( this.opts.values[i], true ); 
			}
		}
		
}

// Handle keypress... this doesn't do much... 
TokenInput.prototype.handleKeyPress = function( e ){
	var ENTER = 13; 
	
	// don't allow the user to create a line break
	// (after all we're inside a text-area)
	if( e.which == ENTER ){
		return false;
	}
}

// Handle the up/down/... keys
// These special keys have to be handled in the "keyDown" method 
// to be called repeatedly when the user holds down one of these keys
TokenInput.prototype.handleSpecialKeys = function( e ){
	var UP = 38; 
	var DOWN = 40; 
	var ENTER = 13; 
	var BACKSPACE = 8; 
	var ESC = 27; 
	
	
	if( e.keyCode == UP ){
		// Select next
		this.hover( this.opts.selection - 1 ); 
	}
	
	if( e.keyCode == DOWN ){			
		// Select previous
		this.hover( this.opts.selection + 1 ); 
	}
	
	if( e.keyCode == ENTER ){
		// Add selection
		if( this.opts.onCreate && this.opts.selection == -1 ){
			this.opts.onCreate( this.elem.input.val(), this ); 
			this.elem.input.val( "" ); 
		}
		else{
			this.select( this.opts.selection ); 
		}
		
		// Remember - this alone is not the key to cancel form
		// submission on all browser. (see end of the constructor for safari!)
		return false; 
	}
	
	if( e.keyCode == BACKSPACE && this.elem.input.val() == "" ){
		// Remove last element
		this.remove( this.opts.tokenObjects.length-1 ); 
	}
	
	if( e.keyCode == ESC ){
		// Cancel current input, transfer focus to some other place
		this.value = ""; 
		this.elem.input.blur(); 
	}
};

// Handles the focus event
TokenInput.prototype.handleFocus = function( e ){
	if( this.opts.onFocus && !this.opts.onFocus( e, this ) ){
		return false; 
	}
	else{
		this.opts.hasFocus = true; 
		this.handleInput(); 
	}
}

// Handles the blur event
TokenInput.prototype.handleBlur = function(){
	if( this.opts.onBlur ){
		this.opts.onBlur(); 
	}
	
	
	// Hide EVERYTHING! 
	this.opts.hasFocus = false; 
	this.opts.selection = -1; 
	this.elem.autocompleteList.find( "tr" ).removeClass( "hover" ); 
	this.elem.autocompleteContainer.hide(); 
};



// Handles the the keydown event
TokenInput.prototype.handleInput = function(){
	// Do we even have a filter function? 
	if( !this.opts.autocomplete ){
		this.opts.selection = -1; 
		return; 
	}

	if( this.opts.lastSearch == this.elem.input.val() ){
		// nope... no need to re-search!!!
		
		// do we enforce list selection? 
		// (we do if there is no onCreate function!)
		if(!this.onCreate && this.opts.selection == -1 ){
			this.hover( 0 ); 
		}
		
		// but make sure the table's visible anyways!
		this.elem.autocompleteContainer.show(); 
		this.layout(); 
		return; 
	}
	else{
		this.startAutocomplete(); 
	}
}

// Starts a new search
TokenInput.prototype.startAutocomplete = function(){
	if( this.opts.autocompleteActive ){
		this.opts.autocompleteLater = true; 
	}
	else{
		this.opts.autocompleteActive = true; 
		this.filerLater = false; 
		
		// Compatibility for Adobe Air
		if( typeof( window["air"] ) != "undefined" && typeof( air["trace"] ) == "function" ){
	        var ti = new air.Timer (1, 1);
			var me = this; 
	        ti.addEventListener( air.TimerEvent.TIMER, function () {
				me.opts.autocomplete( me.elem.input.val(), me ); 
			} ); 
			ti.start(); 
		}
		// Any other javascript client
		else{
			var me = this;  
			var text = this.elem.input.val(); 
			window.setTimeout( function(){ me.opts.autocomplete( text, me ) }, 1 ); 
		}
	}
};

// Give me the search results!!!!
TokenInput.prototype.result = function( objects ){
	// Search, yey! 
	this.opts.lastSearch = this.elem.input.val();
	this.opts.lastResult = objects; 
	this.opts.nrResults = this.opts.lastResult.length; 
	this.opts.selection = -1;
	
	
	// Remove old search results
	this.elem.autocompleteList.find( "tr" ).remove(); 

	
	// Insert the new result
	for( var i in this.opts.lastResult ){
		var cols = ""; 
		for( var j in this.opts.columns ){
			cols += "<td>" + this.opts.lastResult[ i ][ this.opts.columns[j].field ] + "</td>"; 
		}
		
		this.elem.autocompleteList.append( "<tr>" + cols + "</tr>" ); 
	}
	
	// Add hover and click interactivity awsomeness!
	var me = this; 
	this.elem.autocompleteList.find( "tr" ).hover( function(){
		me.hover( this.sectionRowIndex, false ); 
	} ); 
	
	this.elem.autocompleteList.find( "tr" ).mousedown( function(){
		me.select( this.sectionRowIndex ); 
		me.elem.input.blur(); 
		return false; 
	} ); 
	
	// Force list selection? 
	// (we do if there is no onCreate function)
	if(!this.opts.onCreate ){
		this.hover( 0 ); 
	}
	
	// Done, that was tough! 
	this.markDuplicates();
	this.elem.autocompleteContainer.show(); 
	this.layout();
	
	// One more - should we re-filter (already)? 
	this.opts.autocompleteActive = false; 
	if( this.opts.autocompleteLater == true ){
		this.opts.autocompleteLater = false; 
		this.startAutocomplete(); 
	}
};


// Mark all the entries in the dataset that we have already 
// stored as tokens
// Doesn't do much if duplicates is enabled
TokenInput.prototype.markDuplicates = function(){
	if( this.opts.duplicates ){
		return; 
	}
	
	// Make a list of all the ids we currently have
	// Store them as hashtable so we don't need to search
	// for the elements 
	var ids = {}; 
	for( var i in this.opts.tokenObjects ){
		ids[this.opts.tokenObjects[i].id] = true; 
	}
	
	// Now let's not forget to remove all the double-entries
	for( var i in this.opts.lastResult ){
		var row = this.elem.autocompleteList.find( "tr:eq(" + i + ")" ); 
		if( ids[this.opts.lastResult[i].id] ){
			row.addClass( "invalid" ); 
		}
		else{
			row.removeClass( "invalid" ); 
		}
	}
};


// Something changed!
// Updates the value of the source textfield
// and calls onChange
TokenInput.prototype.fireChange = function(){
	var ids = []; 
	for( var i in this.opts.tokenObjects ){
		ids[i] = this.opts.tokenObjects[i].id; 
	}
	
	this.elem.source.val( ids.join( "," ) ); 
	this.opts.onChange( this.opts.tokenObjects, this );
};


// Makes sure things are pretty! 
TokenInput.prototype.layout = function(){
	this.elem.input.css( "paddingLeft", this.elem.positionMarker.position().left + "px" ); 
	var padTop = this.elem.positionMarker.position().top + parseInt(this.elem.positionMarker.css("padding-top") );
	this.elem.input.css( "paddingTop", padTop + "px" ); 
	//alert( this.elem.tokens.height());
	this.elem.input.css( "height", ( 3 + this.elem.tokens.height()) + "px" ); 
	
	//this.elem.tokens.css( "width", this.elem.input.outerWidth() + "px" ); 
	var offset = this.elem.input.offset();
	this.elem.autocompleteContainer.css( "left", offset.left + "px" ); 
	this.elem.autocompleteContainer.css( "width", this.elem.input.innerWidth() + "px" ); 

	// where can we fit the autocomplete box? 
	var spaceTop = offset.top - $(window).scrollTop() - 5; 
	var spaceBottom = $(window).height() - this.elem.input.outerHeight() - spaceTop - 10; 
	var maxH = this.opts.autocompleteMaxHeight; 
	var innerH = this.elem.autocompleteList.outerHeight(); 
	var outerH = this.elem.autocompleteContainer.outerHeight(); 
	
	outerH = Math.min( maxH, outerH?outerH:maxH );
	
	if( spaceBottom > outerH ){
		// Great, fit at bottom! 
		this.elem.autocomplete.css( "height", outerH + "px" ); 
		this.elem.autocompleteContainer.css( "top", ( offset.top + this.elem.input.outerHeight() ) + "px" ); 	
	}
	else if( spaceTop > outerH ){
		// Hm... still okay, fit at top
		this.elem.autocomplete.css( "height", outerH + "px" ); 
		this.elem.autocompleteContainer.css( "top", ( offset.top - this.elem.autocompleteList.outerHeight() - 1 ) + "px" );
	}
	else if( spaceBottom > spaceTop ){
		// Starts to suck, fit at bottom
		this.elem.autocomplete.css( "height", spaceBottom + "px" ); 
		this.elem.autocompleteContainer.css( "top", ( offset.top + this.elem.input.outerHeight() ) + "px" ); 
	}
	else{
		// Let's get nasty! 
		this.elem.autocomplete.css( "height", spaceTop + "px" ); 
		this.elem.autocompleteContainer.css( "top", ( offset.top - this.elem.autocompleteList.outerHeight() - 1 ) + "px" );
	}
};


// Hover the i-the entry of a tokeninput field
TokenInput.prototype.hover = function( i, autoSelectNext ){
	// Disable old selection
	this.elem.autocompleteList.find( "tr" ).removeClass( "hover" ); 
	
	// Make sure i is a valid index... 
	// We do that by looping through all the results until we find one that 
	// is valid. 
	// Let's use the % operator to wrap search over to the beginning... 
	// btw - dir is the search direction, +1 means seach downwards, -1 means search upwards 
	var invalid = true; 
	var count = 0; 
	var index = 0; 
	var dir = i < this.opts.selection?-1:1;
	
	if( autoSelectNext == undefined || autoSelectNext == true ){
		while( invalid && count < this.opts.nrResults ){
			index = ( i + dir*count + this.opts.nrResults ) % this.opts.nrResults;
			if( this.elem.autocompleteList.find( "tr:eq(" + index + ")" ).hasClass( "invalid" ) )
				count ++; 
			else
				invalid = false; 
		}
	}
	else{
		index = i; 
		// invalid = this.elem.autocompleteList.find( "tr:eq(" + index + ")" ).hasClass( "invalid" ); 
		invalid = false; 
	}
	
	if( invalid ){
		this.elem.autocompleteList.find( "tr" ).removeClass( "hover" ); 
		this.opts.selection = -1; 
		return; 
	}
	else{
		this.opts.selection = index; 
		var row = this.elem.autocompleteList.find( "tr:eq(" + index + ")" ); 
		row.addClass( "hover" ); 
		 
		// Is the element visible? 
		var innerH = this.elem.autocompleteList.height(); 
		var outerH = this.elem.autocompleteList.height(); 
		var y = row.position().top;
		var h = row.height(); 
		var scrollY = this.elem.autocomplete[0].scrollTop; 
		
		// Is the row above the current display area? 
//		console.log( "y= " + y + ", scrollY = " + scrollY ); 
		if( y < 0 ){
			// aha!
//			console.log( "above!" ); 
			//this.elem.autocomplete[0].scrollTop += y; 
//			console.log( y ); 
		}
		// Is it below? 
		else if( y + h > innerH ){
			// i know what to do!!!
//			console.log( "below" ); 
//			console.log( y + h - innerH ); 
			//this.elem.autocomplete[0].scrollTop += y + h - innerH; 
		}
		else{
//			console.log( "righty right" ); 
			// must be visible then! 
		}
	}
};



// Selects the i-th entry of a tokeninput field
TokenInput.prototype.select = function( i ){
	this.elem.input.val( "" ); 
	
	// No results? 
	if( i < 0 || i >= this.opts.nrResults ){
		return; 
	}
	
	// Result already inserted? 
	if( this.elem.autocompleteList.find( "tr:eq(" + i + ")" ).hasClass( "invalid" ) ){
		return; 
	}
	
	this.insert( this.opts.lastResult[i] ); 
};



// adds a new token
TokenInput.prototype.insert = function( obj, bypass ){
	// Are there already too many items? 
	if( this.opts.maxItems && this.opts.tokenObjects.length >= maxItems ){
		this.opts.onFull( obj, this ); 
	}
	
	// Run the veto-function if it exists
	// If the veto-function says no we transfer the focus and wait for 
	// something exciting to happen... 
	else if( bypass || this.opts.onInsert( obj, this ) ){
		var html = "<span class='token'>" + 
		           "&#8203;<a class='before'></a>" + 
		           "<a class='center'>" + this.opts.tokenText( obj, this ) + "</a>" + 
		           "<a class='after'></a>&#8203;" + 
		           "</span>";
		
		var token = $( html ).insertBefore( this.elem.insertMarker ); 
		var space = $( "<span>&#32;</span>&#32;" ).insertBefore( this.elem.insertMarker ); 
		var me = this; 
		token.find( "a" ).mousedown( function(){
			// Figure out the current position... 
			for( var j in me.opts.tokenObjects ){
				if( me.opts.tokenObjects[j].id == obj.id ){
					me.remove( j ); 
				}
			}
			
			// Prevent transfering the input focus
			return false; 
		} );
		
		this.opts.tokenObjects[this.opts.tokenObjects.length] = obj;
		
		this.markDuplicates(); 
		this.layout();
		this.fireChange(); 
		this.hover( this.opts.selection );  // make sure a valid index is hovered
	}
	else{
		// Hm... not much to do, it seems! 
		this.elem.input.blur(); 
	}
};



// Removes the i-th token
TokenInput.prototype.remove = function( i, bypass ){
	// Check if the index is in range... 
	var len = this.opts.tokenObjects.length; 
	if( !len || len == 0 ){
		return; 
	}
	
	i = ( ( i % len ) + len ) % len; // Turns negative index to positive ones, 
	                                 // e.g. -1 turns into len - 1

	
	// User-Confirmation
	if( bypass || this.opts.onDelete( this.opts.tokenObjects[i], this ) ){
		this.opts.tokenObjects.splice( i, 1 ); 
		this.elem.tokens.find( "span:eq(" + (2*i) + ")" ).remove(); 
		this.elem.tokens.find( "span:eq(" + (2*i) + ")" ).remove(); 
		this.layout(); 
		this.markDuplicates();
		this.fireChange(); 
		this.hover( this.opts.selection );  // make sure a valid index is hovered
	}
};

// Removes a token with a certain id
TokenInput.prototype.removeId = function( id, bypass ){
	for( var i in this.opts.tokenObjects.length ){
		if( this.opts.tokenObjects[i].id == id ){
			remove( i, bypass ); 
			return true; 
		}
	}
	
	return false; 
};


// Sweet... 
// Now bind the beast to jquery 
$.fn.tokeninput = function( options ){
	this.each( function(){
		var element = $( this );
		
		// Is it already replaced? 
		if( element.data( 'tokeninput' ) ) return element; 
		
		// Nope, create it! 
		var input = new TokenInput( element, options ); 
		element.data( 'tokeninput', input ); 
		
		return element;
	} );
}; 

// The end is near!
})(jQuery); 

