/*!
 *
 * ZSSRichTextEditor v1.0
 * http://www.zedsaid.com
 *
 * Copyright 2013 Zed Said Studio
 *
 */


// If we are using iOS or desktop
var isUsingiOS = true;

// THe default callback parameter separator
var defaultCallbackSeparator = '~';

// The editor object
var ZSSEditor = {};

// The current selection
ZSSEditor.currentSelection;

// The current editing image
ZSSEditor.currentEditingImage;

// The current editing link
ZSSEditor.currentEditingLink;

ZSSEditor.focusedField = null;

// The objects that are enabled
ZSSEditor.enabledItems = {};

ZSSEditor.editableFields = {};

ZSSEditor.lastTappedNode = null;

/**
 * The initializer function that must be called onLoad
 */
ZSSEditor.init = function() {
    
    var editor = $('[contenteditable]').each(function() {
        var editableField = new ZSSField($(this));
        var editableFieldId = editableField.getNodeId();
                                             
        ZSSEditor.editableFields[editableFieldId] = editableField;
        ZSSEditor.callback("callback-new-field", "id=" + editableFieldId);
    });
    
	document.addEventListener("selectionchange", function(e) {
		ZSSEditor.currentEditingLink = null;

		// DRM: only do something here if the editor has focus.  The reason is that when the
		// selection changes due to the editor loosing focus, the focusout event will not be
		// sent if we try to load a callback here.
		//
		if (editor.is(":focus")) {
            ZSSEditor.selectionChangedCallback();
			ZSSEditor.sendEnabledStyles(e);
			var clicked = $(e.target);
			if (!clicked.hasClass('zs_active')) {
				$('img').removeClass('zs_active');
			}
		}
	}, false);

}//end

// MARK: - Debugging logs

ZSSEditor.logMainElementSizes = function() {
    msg = 'Window [w:' + $(window).width() + '|h:' + $(window).height() + ']';
    this.log(msg);
    
    var msg = encodeURIComponent('Viewport [w:' + window.innerWidth + '|h:' + window.innerHeight + ']');
    this.log(msg);
    
    msg = encodeURIComponent('Body [w:' + $(document.body).width() + '|h:' + $(document.body).height() + ']');
    this.log(msg);
    
    msg = encodeURIComponent('HTML [w:' + $('html').width() + '|h:' + $('html').height() + ']');
    this.log(msg);
    
    msg = encodeURIComponent('Document [w:' + $(document).width() + '|h:' + $(document).height() + ']');
    this.log(msg);
};

// MARK: - Viewport Refreshing

ZSSEditor.refreshVisibleViewportSize = function() {
    $(document.body).css('min-height', window.innerHeight + 'px');
    $('#zss_field_content').css('min-height', (window.innerHeight - $('#zss_field_content').position().top) + 'px');
}

// MARK: - Fields

ZSSEditor.focusFirstEditableField = function() {
    $('div[contenteditable=true]:first').focus();
}

ZSSEditor.getField = function(fieldId) {
    
    var field = this.editableFields[fieldId];

    return field;
}

ZSSEditor.getFocusedField = function() {
    var currentField = $(this.closerParentNodeWithName('div'));
    var currentFieldId = currentField.attr('id');
    
    while (currentField
           && (!currentFieldId || this.editableFields[currentFieldId] == null)) {
        currentField = this.closerParentNodeStartingAtNode('div', currentField);
        currentFieldId = currentField.attr('id');
        
    }
    
    return this.editableFields[currentFieldId];
};

// MARK: - Logging

ZSSEditor.log = function(msg) {
	ZSSEditor.callback('callback-log', 'msg=' + msg);
}

// MARK: - Callbacks

ZSSEditor.domLoadedCallback = function() {
	
	ZSSEditor.callback("callback-dom-loaded");
}

ZSSEditor.selectionChangedCallback = function () {
    
    var caretInfo = this.getYCaretInfo();
    
    var arguments = ['yOffset=' + caretInfo.y,
                     'height=' + caretInfo.height];
    
    var joinedArguments = arguments.join(defaultCallbackSeparator);
    
    ZSSEditor.callback('callback-selection-changed', joinedArguments);
}

ZSSEditor.callback = function(callbackScheme, callbackPath) {
    
	var url =  callbackScheme + ":";
 
	if (callbackPath) {
		url = url + callbackPath;
	}
	
	if (isUsingiOS) {
        ZSSEditor.callbackThroughIFrame(url);
	} else {
		console.log(url);
	}
}

/**
 *  @brief      Executes a callback by loading it into an IFrame.
 *  @details    The reason why we're using this instead of window.location is that window.location
 *              can sometimes fail silently when called multiple times in rapid succession.
 *              Found here:
 *              http://stackoverflow.com/questions/10010342/clicking-on-a-link-inside-a-webview-that-will-trigger-a-native-ios-screen-with/10080969#10080969
 *
 *  @param      url     The callback URL.
 */
ZSSEditor.callbackThroughIFrame = function(url) {
    var iframe = document.createElement("IFRAME");
    iframe.setAttribute("src", url);
    document.documentElement.appendChild(iframe);
    iframe.parentNode.removeChild(iframe);
    iframe = null;
}

ZSSEditor.stylesCallback = function(stylesArray) {

	var stylesString = '';
	
	if (stylesArray.length > 0) {
		stylesString = stylesArray.join(defaultCallbackSeparator);
	}

	ZSSEditor.callback("callback-selection-style", stylesString);
}

// MARK: - Selection

ZSSEditor.backupRange = function(){
	var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    ZSSEditor.currentSelection = {"startContainer": range.startContainer, "startOffset":range.startOffset,"endContainer":range.endContainer, "endOffset":range.endOffset};
}

ZSSEditor.restoreRange = function(){
	var selection = window.getSelection();
    selection.removeAllRanges();
    var range = document.createRange();
    range.setStart(ZSSEditor.currentSelection.startContainer, ZSSEditor.currentSelection.startOffset);
    range.setEnd(ZSSEditor.currentSelection.endContainer, ZSSEditor.currentSelection.endOffset);
    selection.addRange(range);
}

ZSSEditor.getSelectedText = function() {
	var selection = window.getSelection();
	
	return selection.toString();
}

ZSSEditor.getYCaretInfo = function() {
    var y = 0, height = 0;
    var sel = window.getSelection();
    if (sel.rangeCount) {
        
        var range = sel.getRangeAt(0);
        var needsToWorkAroundNewlineBug = (range.startOffset == 0);
        
        // PROBLEM: iOS seems to have problems getting the offset for some empty nodes and return
        // 0 (zero) as the selection range top offset.
        //
        // WORKAROUND: To fix this problem we just get the node's offset instead.
        //
        if (needsToWorkAroundNewlineBug) {
            var closerParentNode = ZSSEditor.closerParentNode();
            var closerDiv = ZSSEditor.closerParentNodeWithName('div');
            
            var fontSize = $(closerParentNode).css('font-size');
            var lineHeight = Math.floor(parseInt(fontSize.replace('px','')) * 1.5);
            
            y = closerParentNode.offsetTop;
            height = lineHeight;
        } else {
            if (range.getClientRects) {
                var rects = range.getClientRects();
                if (rects.length > 0) {
                    // PROBLEM: some iOS versions differ in what is returned by getClientRects()
                    // Some versions return the offset from the page's top, some other return the
                    // offset from the visible viewport's top.
                    //
                    // WORKAROUND: see if the offset of the body's top is ever negative.  If it is
                    // then it means that the offset we have is relative to the body's top, and we
                    // should add the scroll offset.
                    //
                    var addsScrollOffset = document.body.getClientRects()[0].top < 0;
                    
                    if (addsScrollOffset) {
                        y = document.body.scrollTop;
                    }
                    
                    y += rects[0].top;
                    height = rects[0].height;
                }
            }
        }
    }
    return { y: y, height: height };
}

// MARK: - Styles

ZSSEditor.setBold = function() {
	document.execCommand('bold', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setItalic = function() {
	document.execCommand('italic', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setSubscript = function() {
	document.execCommand('subscript', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setSuperscript = function() {
	document.execCommand('superscript', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setStrikeThrough = function() {
	var commandName = 'strikeThrough';
	var isDisablingStrikeThrough = ZSSEditor.isCommandEnabled(commandName);
	
	document.execCommand(commandName, false, null);
	
	// DRM: WebKit has a problem disabling strikeThrough when the tag <del> is used instead of
	// <strike>.  The code below serves as a way to fix this issue.
	//
	var mustHandleWebKitIssue = (isDisablingStrikeThrough
								 && ZSSEditor.isCommandEnabled(commandName));
	
	if (mustHandleWebKitIssue) {
		var troublesomeNodeNames = ['del'];
		
		var selection = window.getSelection();
		var range = selection.getRangeAt(0).cloneRange();
		
		var container = range.commonAncestorContainer;
		var nodeFound = false;
		var textNode = null;
		
		while (container && !nodeFound) {
			nodeFound = (container
						 && container.nodeType == document.ELEMENT_NODE
						 && troublesomeNodeNames.indexOf(container.nodeName.toLowerCase()) > -1);
			
			if (!nodeFound) {
				container = container.parentElement;
			}
		}
		
		if (container) {
			var newObject = $(container).replaceWith(container.innerHTML);
			
			var finalSelection = window.getSelection();
			var finalRange = selection.getRangeAt(0).cloneRange();
			
			finalRange.setEnd(finalRange.startContainer, finalRange.startOffset + 1);
			
			selection.removeAllRanges();
			selection.addRange(finalRange);
		}
	}
	
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setUnderline = function() {
	document.execCommand('underline', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setBlockquote = function() {
	var formatTag = "blockquote";
	var formatBlock = document.queryCommandValue('formatBlock');
	 
	if (formatBlock.length > 0 && formatBlock.toLowerCase() == formatTag) {
		document.execCommand('formatBlock', false, '<div>');
	} else {
		document.execCommand('formatBlock', false, '<' + formatTag + '>');
	}

	 ZSSEditor.sendEnabledStyles();
}

ZSSEditor.removeFormating = function() {
	document.execCommand('removeFormat', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setHorizontalRule = function() {
	document.execCommand('insertHorizontalRule', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setHeading = function(heading) {
	var formatTag = heading;
	var formatBlock = document.queryCommandValue('formatBlock');
	
	if (formatBlock.length > 0 && formatBlock.toLowerCase() == formatTag) {
		document.execCommand('formatBlock', false, '<div>');
	} else {
		document.execCommand('formatBlock', false, '<' + formatTag + '>');
	}
	
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setParagraph = function() {
	var formatTag = "p";
	var formatBlock = document.queryCommandValue('formatBlock');
	
	if (formatBlock.length > 0 && formatBlock.toLowerCase() == formatTag) {
		document.execCommand('formatBlock', false, '<div>');
	} else {
		document.execCommand('formatBlock', false, '<' + formatTag + '>');
	}
	
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.undo = function() {
	document.execCommand('undo', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.redo = function() {
	document.execCommand('redo', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setOrderedList = function() {
	document.execCommand('insertOrderedList', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setUnorderedList = function() {
	document.execCommand('insertUnorderedList', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setJustifyCenter = function() {
	document.execCommand('justifyCenter', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setJustifyFull = function() {
	document.execCommand('justifyFull', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setJustifyLeft = function() {
	document.execCommand('justifyLeft', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setJustifyRight = function() {
	document.execCommand('justifyRight', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setIndent = function() {
	document.execCommand('indent', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setOutdent = function() {
	document.execCommand('outdent', false, null);
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.setTextColor = function(color) {
    ZSSEditor.restoreRange();
	document.execCommand("styleWithCSS", null, true);
	document.execCommand('foreColor', false, color);
	document.execCommand("styleWithCSS", null, false);
	ZSSEditor.sendEnabledStyles();
    // document.execCommand("removeFormat", false, "foreColor"); // Removes just foreColor
}

ZSSEditor.setBackgroundColor = function(color) {
	ZSSEditor.restoreRange();
	document.execCommand("styleWithCSS", null, true);
	document.execCommand('hiliteColor', false, color);
	document.execCommand("styleWithCSS", null, false);
	ZSSEditor.sendEnabledStyles();
}

// Needs addClass method

ZSSEditor.insertLink = function(url, title) {

    ZSSEditor.restoreRange();
	
    var sel = document.getSelection();
	if (sel.rangeCount) {

		var el = document.createElement("a");
		el.setAttribute("href", url);
		
		var range = sel.getRangeAt(0).cloneRange();
		range.surroundContents(el);
		el.innerHTML = title;
		sel.removeAllRanges();
		sel.addRange(range);
	}

	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.updateLink = function(url, title) {
	
    ZSSEditor.restoreRange();
	
    var currentLinkNode = ZSSEditor.lastTappedNode;
	
    if (currentLinkNode) {
		currentLinkNode.setAttribute("href", url);
		currentLinkNode.innerHTML = title;
    }
    ZSSEditor.sendEnabledStyles();
}

ZSSEditor.unlink = function() {
	
	var currentLinkNode = ZSSEditor.closerParentNodeWithName('a');
	
	if (currentLinkNode) {
		ZSSEditor.unwrapNode(currentLinkNode);
	}
	
	ZSSEditor.sendEnabledStyles();
}

ZSSEditor.updateImage = function(url, alt) {

    ZSSEditor.restoreRange();

    if (ZSSEditor.currentEditingImage) {
        var c = ZSSEditor.currentEditingImage;
        c.attr('src', url);
        c.attr('alt', alt);
    }
    ZSSEditor.sendEnabledStyles();

}//end

ZSSEditor.unwrapNode = function(node) {
	var newObject = $(node).replaceWith(node.innerHTML);
}

ZSSEditor.quickLink = function() {
	
	var sel = document.getSelection();
	var link_url = "";
	var test = new String(sel);
	var mailregexp = new RegExp("^(.+)(\@)(.+)$", "gi");
	if (test.search(mailregexp) == -1) {
		checkhttplink = new RegExp("^http\:\/\/", "gi");
		if (test.search(checkhttplink) == -1) {
			checkanchorlink = new RegExp("^\#", "gi");
			if (test.search(checkanchorlink) == -1) {
				link_url = "http://" + sel;
			} else {
				link_url = sel;
			}
		} else {
			link_url = sel;
		}
	} else {
		checkmaillink = new RegExp("^mailto\:", "gi");
		if (test.search(checkmaillink) == -1) {
			link_url = "mailto:" + sel;
		} else {
			link_url = sel;
		}
	}

	var html_code = '<a href="' + link_url + '">' + sel + '</a>';
	ZSSEditor.insertHTML(html_code);
}

// MARK: - Images

/**
 *  @brief      Inserts a local image URL.  Useful for images that need to be uploaded.
 *  @details    By inserting a local image URL, we can make sure the image is shown to the user
 *              as soon as it's selected for uploading.  Once the image is successfully uploaded
 *              the application should call replaceLocalImageWithRemoteImage().
 *
 *  @param      imageNodeIndetifier     This is a unique ID provided by the caller.  It exists as
 *                                      a mechanism to update the image node with the remote URL
 *                                      when replaceLocalImageWithRemoteImage() is called.
 *  @param      localImageUrl           The URL of the local image to display.  Please keep in mind
 *                                      that a remote URL can be used here too, since this method
 *                                      does not check for that.  It would be a mistake.
 */
ZSSEditor.insertLocalImage = function(imageNodeIndentifier, localImageUrl) {
    var html = '<img id="' + identifier + '" src="' + url + '" alt="" />';
    
    this.insertHTML(html);
    this.sendEnabledStyles();
};

ZSSEditor.insertImage = function(url, alt) {
    var html = '<img src="'+url+'" alt="'+alt+'" />';
    
    this.insertHTML(html);
    this.sendEnabledStyles();
}

/**
 *  @brief      Replaces a local image URL with a remote image URL.  Useful for images that have
 *              just finished uploading.
 *  @details    The remote image can be available after a while, when uploading images.  This method
 *              allows for the remote URL to be loaded once the upload completes.
 *
 *  @param      imageNodeIndetifier     This is a unique ID provided by the caller.  It exists as
 *                                      a mechanism to update the image node with the remote URL
 *                                      when replaceLocalImageWithRemoteImage() is called.
 *  @param      remoteImageUrl          The URL of the remote image to display.
 */
ZSSEditor.replaceLocalImageWithRemoteImage = function(imageNodeIndentifier, remoteImageUrl) {
    
    var imageNode = $('#' + imageNodeIndentifier);
    
    if (imageNode) {
        imageNode.attr('src', remoteImageUrl);
    }
}

// MARK: - Commands

ZSSEditor.insertHTML = function(html) {
	document.execCommand('insertHTML', false, html);
	this.sendEnabledStyles();
}

ZSSEditor.isCommandEnabled = function(commandName) {
	return document.queryCommandState(commandName);
}

ZSSEditor.formatNewLine = function(e) {
    // Check to see if the enter key is pressed
    if(e.keyCode == '13') {
        var currentField = this.getFocusedField();
        
        if (currentField.isMultiline()) {
            var currentNode = ZSSEditor.closerParentNodeWithName('blockquote');
            if (!currentNode && !ZSSEditor.isCommandEnabled('insertOrderedList') &&
                !ZSSEditor.isCommandEnabled('insertUnorderedList')) {
                document.execCommand('formatBlock', false, 'p');
            }
        } else {
            e.preventDefault();
        }
    }
}

ZSSEditor.sendEnabledStyles = function(e) {

	var items = [];
	
	// Find all relevant parent tags
	var parentTags = ZSSEditor.parentTags();
	
	for (var i = 0; i < parentTags.length; i++) {
		var currentNode = parentTags[i];
		
		if (currentNode.nodeName.toLowerCase() == 'a') {
			ZSSEditor.currentEditingLink = currentNode;
			
			var title = encodeURIComponent(currentNode.text);
			var href = encodeURIComponent(currentNode.href);
			
			items.push('link-title:' + title);
			items.push('link:' + href);
		}
	}
	
	if (ZSSEditor.isCommandEnabled('bold')) {
		items.push('bold');
	}
	if (ZSSEditor.isCommandEnabled('createLink')) {
		items.push('createLink');
	}
	if (ZSSEditor.isCommandEnabled('italic')) {
		items.push('italic');
	}
	if (ZSSEditor.isCommandEnabled('subscript')) {
		items.push('subscript');
	}
	if (ZSSEditor.isCommandEnabled('superscript')) {
		items.push('superscript');
	}
	if (ZSSEditor.isCommandEnabled('strikeThrough')) {
		items.push('strikeThrough');
	}
	if (ZSSEditor.isCommandEnabled('underline')) {
		var isUnderlined = false;
		
		// DRM: 'underline' gets highlighted if it's inside of a link... so we need a special test
		// in that case.
		if (!ZSSEditor.currentEditingLink) {
			items.push('underline');
		}
	}
	if (ZSSEditor.isCommandEnabled('insertOrderedList')) {
		items.push('orderedList');
	}
	if (ZSSEditor.isCommandEnabled('insertUnorderedList')) {
		items.push('unorderedList');
	}
	if (ZSSEditor.isCommandEnabled('justifyCenter')) {
		items.push('justifyCenter');
	}
	if (ZSSEditor.isCommandEnabled('justifyFull')) {
		items.push('justifyFull');
	}
	if (ZSSEditor.isCommandEnabled('justifyLeft')) {
		items.push('justifyLeft');
	}
	if (ZSSEditor.isCommandEnabled('justifyRight')) {
		items.push('justifyRight');
	}
    if (ZSSEditor.isCommandEnabled('insertHorizontalRule')) {
		items.push('horizontalRule');
	}
	var formatBlock = document.queryCommandValue('formatBlock');
	if (formatBlock.length > 0) {
		items.push(formatBlock);
	}
    // Images
	$('img').bind('touchstart', function(e) {
        $('img').removeClass('zs_active');
        $(this).addClass('zs_active');
    });
	
	// Use jQuery to figure out those that are not supported
	if (typeof(e) != "undefined") {
		
		// The target element
		var t = $(e.target);
		var nodeName = e.target.nodeName.toLowerCase();
		
		// Background Color
		try
		{
			var bgColor = t.css('backgroundColor');
			if (bgColor && bgColor.length != 0 && bgColor != 'rgba(0, 0, 0, 0)' && bgColor != 'rgb(0, 0, 0)' && bgColor != 'transparent') {
				items.push('backgroundColor');
			}
		}
		catch(e)
		{
			// DRM: I had to add these stupid try-catch blocks to solve an issue with t.css throwing
			// exceptions for no reason.
		}
		
		// Text Color
		try
		{
			var textColor = t.css('color');
			if (textColor && textColor.length != 0 && textColor != 'rgba(0, 0, 0, 0)' && textColor != 'rgb(0, 0, 0)' && textColor != 'transparent') {
				items.push('textColor');
			}
		}
		catch(e)
		{
			// DRM: I had to add these stupid try-catch blocks to solve an issue with t.css throwing
			// exceptions for no reason.
		}
		
        // Blockquote
        if (nodeName == 'blockquote') {
			items.push('indent');
		}
        // Image
        if (nodeName == 'img') {
            ZSSEditor.currentEditingImage = t;
            items.push('image:'+t.attr('src'));
            if (t.attr('alt') !== undefined) {
                items.push('image-alt:'+t.attr('alt'));
            }
            
        } else {
            ZSSEditor.currentEditingImage = null;
        }
	}
	
	ZSSEditor.stylesCallback(items);
}

// MARK: - Parent nodes & tags

ZSSEditor.closerParentNode = function() {
    
    var parentNode = null;
    var selection = window.getSelection();
    var range = selection.getRangeAt(0).cloneRange();
    
    var currentNode = range.commonAncestorContainer;
    
    while (currentNode) {
        if (currentNode.nodeType == document.ELEMENT_NODE) {
            parentNode = currentNode;
            
            break;
        }
        
        currentNode = currentNode.parentElement;
    }
    
    return parentNode;
}

ZSSEditor.closerParentNodeStartingAtNode = function(nodeName, startingNode) {
    
    nodeName = nodeName.toLowerCase();
    
    var parentNode = null;
    var currentNode = startingNode,parentElement;
    
    while (currentNode) {
        
        if (currentNode.nodeName == document.body.nodeName) {
            break;
        }
        
        if (currentNode.nodeName.toLowerCase() == nodeName
            && currentNode.nodeType == document.ELEMENT_NODE) {
            parentNode = currentNode;
            
            break;
        }
        
        currentNode = currentNode.parentElement;
    }
    
    return parentNode;
}

ZSSEditor.closerParentNodeWithName = function(nodeName) {
    
    nodeName = nodeName.toLowerCase();
    
    var parentNode = null;
    var selection = window.getSelection();
    var range = selection.getRangeAt(0).cloneRange();
    
    var currentNode = range.commonAncestorContainer;
    
    while (currentNode) {
        
        if (currentNode.nodeName == document.body.nodeName) {
            break;
        }
        
        if (currentNode.nodeName.toLowerCase() == nodeName
            && currentNode.nodeType == document.ELEMENT_NODE) {
            parentNode = currentNode;
            
            break;
        }
        
        currentNode = currentNode.parentElement;
    }
    
    return parentNode;
}

ZSSEditor.parentTags = function() {
    
    var parentTags = [];
    var selection = window.getSelection();
    var range = selection.getRangeAt(0);
    
    var currentNode = range.commonAncestorContainer;
    while (currentNode) {
        
        if (currentNode.nodeName == document.body.nodeName) {
            break;
        }
        
        if (currentNode.nodeType == document.ELEMENT_NODE) {
            parentTags.push(currentNode);
        }
        
        currentNode = currentNode.parentElement;
    }
    
    return parentTags;
}

// MARK: - ZSSField Constructor

function ZSSField(wrappedObject) {
    this.multiline = false;
    this.wrappedObject = wrappedObject;
    this.bodyPlaceholderColor = '#000000';
    
    this.bindListeners();
}

ZSSField.prototype.bindListeners = function() {
    
    var thisObj = this;
    
    this.wrappedObject.bind('tap', function(e) { thisObj.handleTapEvent(e); });
    this.wrappedObject.bind('focus', function(e) { thisObj.handleFocusEvent(e); });
    this.wrappedObject.bind('blur', function(e) { thisObj.handleBlurEvent(e); });
    this.wrappedObject.bind('keydown', function(e) { thisObj.handleKeyDownEvent(e); });
    this.wrappedObject.bind('input', function(e) { thisObj.handleInputEvent(e); });
};

// MARK: - Handle event listeners

ZSSField.prototype.handleBlurEvent = function(e) {
    ZSSEditor.focusedField = null;
    
    // IMPORTANT: sometimes HTML leaves some <br> tags or &nbsp; when the user deletes all
    // text from a contentEditable field.  This code makes sure no such 'garbage' survives.
    //
    if (this.wrappedObject.text().length == 0) {
        this.wrappedObject.empty();
    }
    
    this.refreshPlaceholderColor();
    this.callback("callback-focus-out");
};

ZSSField.prototype.handleFocusEvent = function(e) {
    ZSSEditor.focusedField = this;
    
    // IMPORTANT: this is the only case where checking the current focus will not work.
    // We sidestep this issue by indicating that the field is about to gain focus.
    //
    this.refreshPlaceholderColorAboutToGainFocus(true);
    this.callback("callback-focus-in");
};

ZSSField.prototype.handleKeyDownEvent = function(e) {
    ZSSEditor.formatNewLine(e);
};

ZSSField.prototype.handleInputEvent = function(e) {    
    var caretInfo = ZSSEditor
    .getYCaretInfo();
    
    var arguments = ['yOffset=' + caretInfo.y,
                     'height=' + caretInfo.height];
    
    var joinedArguments = arguments.join(defaultCallbackSeparator);
    
    ZSSEditor.callback('callback-selection-changed', joinedArguments);
    
    this.callback("callback-input", joinedArguments);
};

ZSSField.prototype.handleTapEvent = function(e) {
    var targetNode = e.target;
    
    if (targetNode) {
        
        ZSSEditor.lastTappedNode = targetNode;
        
        if (targetNode.nodeName.toLowerCase() == 'a') {
            var arguments = ['url=' + encodeURIComponent(targetNode.href),
                             'title=' + encodeURIComponent(targetNode.innerHTML)];
            
            var joinedArguments = arguments.join(defaultCallbackSeparator);
            
            var thisObj = this;
            
            // WORKAROUND: force the event to become sort of "after-tap" through setTimeout()
            //
            setTimeout(function() { thisObj.callback('callback-link-tap', joinedArguments);}, 500);
        }
    }
}

// MARK: - Callback Execution

ZSSField.prototype.callback = function(callbackScheme, callbackPath) {
    
    var url = callbackScheme + ":";
    
    url = url + "id=" + this.getNodeId();

    if (callbackPath) {
        url = url + defaultCallbackSeparator + callbackPath;
    }
    
    if (isUsingiOS) {
        this.callbackThroughIFrame(url);
    } else {
        console.log(url);
    }
};

/**
 *  @brief      Executes a callback by loading it into an IFrame.
 *  @details    The reason why we're using this instead of window.location is that window.location
 *              can sometimes fail silently when called multiple times in rapid succession.
 *              Found here:
 *              http://stackoverflow.com/questions/10010342/clicking-on-a-link-inside-a-webview-that-will-trigger-a-native-ios-screen-with/10080969#10080969
 *
 *  @param      url     The callback URL.
 */
ZSSField.prototype.callbackThroughIFrame = function(url) {
    var iframe = document.createElement("IFRAME");
    iframe.setAttribute("src", url);
    document.documentElement.appendChild(iframe);
    iframe.parentNode.removeChild(iframe);
    iframe = null;
};

// MARK: - Focus

ZSSField.prototype.isFocused = function() {

    return this.wrappedObject.is(':focus');
}

ZSSField.prototype.focus = function() {
    
    if (!this.isFocused()) {
        this.wrappedObject.focus();
    }
}

ZSSField.prototype.blur = function() {
    if (this.isFocused()) {
        this.wrappedObject.blur();
    }
};

// MARK: - Multiline support

ZSSField.prototype.isMultiline = function() {
    return this.multiline;
}

ZSSField.prototype.setMultiline = function(multiline) {
    this.multiline = multiline;
}

// MARK: - NodeId

ZSSField.prototype.getNodeId = function() {
    return this.wrappedObject.attr('id');
};

// MARK: - Editing

ZSSField.prototype.enableEditing = function () {
    
    this.wrappedObject.attr('contenteditable', true);
    
    if (!ZSSEditor.focusedField) {
        ZSSEditor.focusFirstEditableField();
    }
};

ZSSField.prototype.disableEditing = function () {
    // IMPORTANT: we're blurring the field before making it non-editable since that ensures
    // that the iOS keyboard is dismissed through an animation, as opposed to being immediately
    // removed from the screen.
    //
    this.blur();
    
    this.wrappedObject.attr('contenteditable', false);
};

// MARK: - HTML contents

ZSSField.prototype.isEmpty = function() {
    var html = this.getHTML();
    var isEmpty = (html.length == 0 || html == "<br>");
    
    return isEmpty;
}

ZSSField.prototype.getHTML = function() {
    return this.wrappedObject.html();
}

ZSSField.prototype.setHTML = function(html) {
    this.wrappedObject.html(html);
    this.refreshPlaceholderColor();
}

// MARK: - Placeholder

ZSSField.prototype.hasPlaceholderText = function() {
    return this.wrappedObject.attr('placeholderText') != null;
};

ZSSField.prototype.setPlaceholderText = function(placeholder) {
    
    this.wrappedObject.attr('placeholderText', placeholder);
}

ZSSField.prototype.setPlaceholderColor = function(color) {
    this.bodyPlaceholderColor = color;
    this.refreshPlaceholderColor();
};

ZSSField.prototype.refreshPlaceholderColor = function() {
     this.refreshPlaceholderColorForAttributes(this.hasPlaceholderText(),
                                               this.isFocused(),
                                               this.isEmpty());
}

ZSSField.prototype.refreshPlaceholderColorAboutToGainFocus = function(willGainFocus) {
    this.refreshPlaceholderColorForAttributes(this.hasPlaceholderText(),
                                              willGainFocus,
                                              this.isEmpty());
}

ZSSField.prototype.refreshPlaceholderColorForAttributes = function(hasPlaceholderText, isFocused, isEmpty) {
    
    var shouldColorText = hasPlaceholderText && !isFocused && isEmpty;
    
    if (shouldColorText) {
        this.wrappedObject.css('color', this.bodyPlaceholderColor);
    } else {
        this.wrappedObject.css('color', '');
    }
    
};
