/**
 * [includeme.js]
 * Collections - Research data packaging for the rest of us
 * Copyright (C) 2017 Intersect Australia Ltd (https://intersect.org.au)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

function recalculateFileTreePosition() {
    var barActionHeight = $('.bar-actions').height();
    var titleHeight = parseInt(barActionHeight);
    $('#files').css('margin-top', titleHeight.toString() + 'px');
}

$(window).resize(recalculateFileTreePosition);

function displayError(errorMessage) {
    OC.Notification.showTemporary('There was an error: ' + errorMessage);
}

function indentTree() {
    $tree.find('.jqtree-element').each(function () {
        var indent = $(this).parents('li').length * 20;
        $(this).css('padding-left', indent);
        $(this).css('background-position', indent + 20 + 'px 50%');
    });
}

function attachModalHandlers($modal, confirmCallback) {
    var $confirm = $modal.find('.btn-primary');
    var confirmDisabled = $confirm.prop('disabled');

    var clearInput = function () {
        var $input = $modal.find('input');
        if ($input) {
            $input.val('');
        }
        var $label = $modal.find('label');
        if ($label) {
            $label.hide();
        }
    };

    $confirm.click(function () {
        confirmCallback();
        $modal.modal('hide');
    });


    $modal.on('hide.bs.modal', function () {
        $confirm.off('click');
        $confirm.prop('disabled', confirmDisabled);
        clearInput();
    });

    $modal.modal('show');
};

function transformCrate(crate) {
    return [{id: 'rootfolder', folderId:crate.rootFolderId, crateId: crate.id, label: crate.name, children: transformFolder(crate.rootFolder)}];
}

function transformFolder(folder) {
    subfolders = _.map(folder.folders, function(subfolder){
        return {id: 'folder', folderId: subfolder.id, label: subfolder.name, children: transformFolder(subfolder)}
    });
    subfiles = _.map(folder.files, function(file){
        return {id: 'file', fileId: file.id, label: file.name, mime: file.mimeType}
    });
    return subfolders.concat(subfiles);
}

function buildFileTree(crate) {
    var createImgUrl = function (node) {
        var icon_set = ['application-pdf', 'application', 'audio', 'file',  'folder-drag-accept', 'folder-external',
            'folder-public', 'folder-shared', 'folder-starred', 'folder', 'image', 'package-x-generic', 'text-calendar',
            'text-code', 'text-vcard', 'text', 'video', 'x-office-document', 'x-office-presentation',
            'x-office-spreadsheet'
        ];
        var icon = 'file';
        if (node.id == 'rootfolder') {
            return 'url(' + OC.filePath('collections', 'img', 'milk-crate-dark.png') + ')';
        } else if (node.id == 'folder') {
            icon = 'folder';
        } else if (node.id == 'file') {
            var mime_base = node.mime.split('/')[0];
            var mime = node.mime.replace(/\//, '-');
            if ($.inArray(mime, icon_set) > -1) {
                icon = mime;
            } else if ($.inArray(mime_base, icon_set) > -1) {
                icon = mime_base;
            }
        } else {
            icon = 'file';
        }
        return 'url(' + OC.imagePath('core', 'filetypes/' + icon + '.svg') + ')';
    };

    var addFolder = function (parentNode) {
        var $modal = $('#addFolderModal');
        $('#add-folder').keyup(function () {
            var $input = $('#add-folder');
            var $error = $('#add_folder_error');
            var $confirm = $modal.find('.btn-primary');
            validateItemName($input, $error, $confirm, parentNode.children);
        });
        var confirmCallback = function () {
            var parentFolderId = parentNode.folderId;
            var newFolderName = $('#add-folder').val();
            var crateId = getSelectedCrateId();
            var c_url = OC.generateUrl('apps/collections/crate/addFolder');
            $.ajax({
                url: c_url,
                type: 'post',
                dataType: 'json',
                data: {
                    'crate_id': crateId,
                    'parentFolderId': parentFolderId,
                    'folderName': newFolderName
                },
                success: function(newFolder) {
                    $tree.tree('appendNode', {
                        id: 'folder',
                        folderId: newFolder.id,
                        label: newFolder.name,
                        children: []
                    }, parentNode);
                    $tree.tree('openNode', parentNode);
                    indentTree();
                },
                error: function(jqXHR) {
                    displayError(jqXHR.responseJSON.msg);
                }
            });
        };
        attachModalHandlers($modal, confirmCallback);
    };

    var renameCrate = function (node) {
        var $modal = $('#renameCrateModal');
        var oldName = node.name;
        $('#rename-crate').val(oldName);
        $('#rename-crate').on("input",function() {
            var $input = $('#rename-crate');
            var $error = $('#rename_crate_error');
            var $confirm = $modal.find('.btn-primary');
            validateCrateName($input, $error, $confirm);
        });

        var confirmCallback = function () {
            var newCrateName = $('#rename-crate').val();
            var c_url = OC.generateUrl('apps/collections/crate/update');
            $.ajax({
                url: c_url,
                type: 'post',
                dataType: 'json',
                data: {
                    'crate_id': getSelectedCrateId(),
                    'fields': {
                        'name': newCrateName.trim(),
                    }
                },
                success: function (data) {
                    $tree.tree('updateNode', node, newCrateName);
                    indentTree();
                    $('#crates option:selected').val(node.crateId).attr('id', node.crateId).text(truncateString(newCrateName,32));
                },
                error: function (jqXHR) {
                    $tree.tree('updateNode', node, oldName);
                    indentTree();
                    displayError(jqXHR.responseJSON.msg);
                }
            });
        };
        // the successMessage function gets called after the name has changed
        attachModalHandlers($modal, confirmCallback);
    };

    var renameItem = function (node) {
        var $modal = $('#renameItemModal');
        $('#rename-item').val(node.name);
        $('#rename-item').on("input",function() {
            var $input = $('#rename-item');
            var $error = $('#rename_item_error');
            var $confirm = $modal.find('.btn-primary');
            validateItemName($input, $error, $confirm, node.parent.children);
        });
        var confirmCallback = function () {
            var newName = $('#rename-item').val();
            var c_url = OC.generateUrl('apps/collections/crate/rename_node');
            $.ajax({
                url: c_url,
                type: 'post',
                dataType: 'json',
                data: {
                    'crate_id': getSelectedCrateId(),
                    'name': newName,
                    "type": node.id,
                    "id": node.fileId==undefined? node.folderId:node.fileId,
                },
                success: function (data) {
                    $tree.tree('updateNode', node, newName);
                    indentTree();
                },
                error: function (jqXHR) {
                    displayError(jqXHR.responseJSON.msg);
                }
            });

        };
        attachModalHandlers($modal, confirmCallback);
    };

    var removeItem = function (node) {
        var $modal = $('#removeCrateModal');
        var msg = "Remove item '" + node.name + "' from collection?";
        $modal.find('.modal-body > p').text(msg);
        var confirmCallback = function () {
            var c_url = OC.generateUrl('apps/collections/crate/delete_node');
            $.ajax({
                url: c_url,
                type: 'post',
                dataType: 'json',
                data: {
                    'crate_id': getSelectedCrateId(),
                    'type': node.id,
                    'id': node.fileId == undefined? node.folderId : node.fileId
                },
                success: function (data) {
                    var crate = data['crate'];
                    updateCrateSize(crate);
                    $tree.tree('removeNode', node);
                    indentTree();
                },
                error: function(jqXHR) {
                    displayError(jqXHR.responseJSON.msg);
                }
            });
        };
        attachModalHandlers($modal, confirmCallback);
    };

    $tree = $('#files').tree({
        data: crate,
        autoOpen: false,
        dragAndDrop: true,
        saveState: false,
        selectable: false,
        useContextMenu: false,
        onCreateLi: function (node, $li) {
            $div = $li.find('.jqtree-element');
            $div.css('background-image', createImgUrl(node));
            $ul = $div.append('<ul class="crate-actions pull-right"></ul>').find('ul');
            $title = $div.find('.jqtree-title');
            // append consistency checker icon
            var valid = node.valid;
            if (valid == 'false') {
                $title.prepend('<i class="fa fa-times" style="color:red;  padding-right: 5px;"></i>');
            }
            else if (valid == 'true') {
                $title.prepend('<i class="fa fa-check" style="color:green; padding-right: 5px;"></i>');
            }
            // Hack to truncate the node title without overwriting the prepended validity icon html
            var text = $title.text(); // assumes that title name is the only inner text
            var html = $title.html();
            html = html.substring(0, html.length - text.length); // assumes text is at end of html
            text = truncateString(text, 32);
            $title.html(html + text); // necessary as $title.text() overwrites the inner html as well as the inner text
            
            var type = node.id;
            if (type == 'rootfolder' || type == 'folder') {
                $ul.append('<li><a id="addFolder"><i class="fa fa-plus"></i>Add Folder Item</a></li>');
                $ul.find('.fa-plus').parent().click(function () {
                    addFolder(node);
                });
            }
            if (type == 'rootfolder') {
                $div.addClass('rootfolder');
                $ul.append('<li><a id="renameCrate"><i class="fa fa-pencil"></i>Rename Collection</a></li>');
            } else {
                $ul.append('<li><a id="renameItem"><i class="fa fa-pencil"></i>Rename Item</a></li>');
            }
            $ul.find('.fa-pencil').parent().click(function () {
                if (type == 'rootfolder') {
                    renameCrate(node);
                } else {
                    renameItem(node);
                }
            });
            if (type != 'rootfolder') {
                $ul.append('<li><a id="removeItem"><i class="fa fa-ban"></i>Remove Item</a></li>');
                $ul.find('.fa-ban').parent().click(function () {
                    removeItem(node);
                });
            }
        },
        onCanMove: function (node) {
            var result = true;
            // Cannot move root node
            if (!node.parent.parent) {
                result = false;
            }
            return result;
        },
        onCanMoveTo: function (moved_node, target_node, position) {
            // Can move before or after any node.
            // Can only move INSIDE of a node whose id ends with 'folder'
            if (target_node.id.indexOf('folder', target_node.id.length - 'folder'.length) == -1) {
                return (position != 'inside');
            } else if (target_node.id == 'rootfolder') {
                return (position != 'before' && position != 'after');
            } else {
                return true;
            }
        },
    });

    $tree.bind('tree.move', function (event) {
        event.preventDefault();
        var move_info = event.move_info;
        var json_moved_node = {
            'crate_id': getSelectedCrateId(),
            "name": move_info.moved_node.name,
            "type": move_info.moved_node.id,
            "id": move_info.moved_node.fileId==undefined? move_info.moved_node.folderId:move_info.moved_node.fileId,
            "parentFolderId":move_info.position=='after' ? move_info.target_node.parent.folderId:move_info.target_node.folderId
        };
        var c_url = OC.generateUrl('apps/collections/crate/move_node');
        $.ajax({
            url: c_url,
            type: 'post',
            dataType: 'json',
            data: json_moved_node,
            success: function (data) {
                move_info.do_move();
                indentTree();
            },
            error: function (jqXHR) {
                displayError(jqXHR.responseJSON.msg);
                indentTree();
            }
        });

    });

    expandRoot();

    return $tree;
}


function updateCrateSize(crate) {
    var maxZipMB = templateVars['max_zip_mb'];
    var publishWarningMB = templateVars['publish_warning_mb'];

    var humanCrateSize = filesize(crate.size, {round: 1});
    $('#crate_size_human').text(humanCrateSize);
    $('#crate_size_human_publish').text(humanCrateSize);

    var crate_size_mb = crate.size / (1024 * 1024);
    var warnings = [];
    var notify = false;
    var disablePublish = false;
    //var disableDownload = false;

    if (maxZipMB > 0 && crate_size_mb > maxZipMB) {
        warnings.push('exceeds ZIP file limit');
        //warnings.push('package and download operations are disabled');
        warnings.push('package operation is disabled');
        //disableDownload = true;
        disablePublish = true;
        notify = true;
    } else if (publishWarningMB > 0 && crate_size_mb > publishWarningMB) {
        warnings.push('will cause publishing to take a long time');
        notify = true;
    }

    var msg = 'WARNING: Collection size ' + warnings.join(', and ') + '.';
    if (disablePublish) {
        $('#publish').attr("disabled", "disabled");
    } else {
        $('#publish').removeAttr("disabled");
    }
    //if (disableDownload) {
    //    $('#download').attr("disabled", "disabled");
    //} else {
    //    $('#download').removeAttr("disabled");
    //}

    if (notify) {
        OC.Notification.showTemporary(msg);
    }
}

function makeCrateListEditable() {
    $('#crateList .title').editable(OC.linkTo('collections', 'ajax/bagit_handler.php') + '?action=edit_title', {
        name: 'new_title',
        indicator: '<img src=' + OC.imagePath('collections', 'indicator.gif') + '>',
        tooltip: 'Double click to edit...',
        event: 'dblclick',
        style: 'inherit',
        submitdata: function (value, settings) {
            return {
                'elementid': this.parentNode.parentNode.getAttribute('id')
            };
        }
    });
}

function expandRoot() {
    var rootnode = $tree.tree('getNodeById', 'rootfolder'); // NOTE: also see getTree
    $tree.tree('openNode', rootnode);
}

function treeHasNoFiles() {
    var children = $tree.tree('getNodeById', 'rootfolder').children;
    return children.length == 0;
}

function activateRemoveCreatorButton(buttonObj) {
    buttonObj.click('click', function (event) {
        // Remove people from backend
        var id = $(this).attr("id");
        creator_id = id.replace("creator_", "");

        $.ajax({
            url: OC.linkTo('collections', 'ajax/bagit_handler.php'),
            type: 'post',
            dataType: 'json',
            data: {
                'action': 'remove_people',
                'creator_id': creator_id,
                'full_name': $(this).parent().text()
            },
            success: function (data) {
                buttonObj.parent().remove();
            },
            error: function (data) {
                displayError(data.statusText);
            }
        });
    });
}

function validateEmail($input, $error, $confirm) {
    validateTextLength($input, $error, $confirm, 128, true);
    var email = $input.val();
    var isEmail = function () {
        var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
        return regex.test(email);
    };
    if (email.length > 0 && !isEmail()) {
        $confirm.prop('disabled', true);
        $error.text('Not recognised as a valid email address');
        $error.show();
    }
}

function validateYear($input, $error, $confirm) {
    var inputYear = $.trim($input.val());
    var isYear = function () {
        var regex = /^\d{4}$/;
        return regex.test(inputYear);
    };
    var emptyYear = function () {
        return (!inputYear || /^\s*$/.test(inputYear));
    };
    if (emptyYear()) {
        $confirm.prop('disabled', true);
        $error.text('Year can not be blank');
        $error.show();
    } else if (!isYear()) {
        $confirm.prop('disabled', true);
        $error.text('Must be a valid submit year');
        $error.show();
    } else {
        $confirm.prop('disabled', false);
        $error.hide();
    }
}

function validateTextLength($input, $error, $confirm, maxLength, allowEmpty) {
    if (typeof(maxLength) === 'undefined') {
        maxLength = 256;
    }
    if (typeof(allowEmpty) === 'undefined') {
        allowEmpty = false;
    }
    var inputText = $input.val();
    var emptyText = function () {
        return (!inputText || /^\s*$/.test(inputText));
    };
    if (!allowEmpty && emptyText()) {
        $confirm.prop('disabled', true);
        $error.text('Field cannot be blank');
        $error.show();
    } else if (inputText.length > maxLength) {
        $error.text('Field has reached the limit of ' + maxLength + ' characters');
        $input.val(inputText.substr(0, maxLength));
        $error.show();
        $confirm.prop('disabled', false);
    } else {
        $confirm.prop('disabled', false);
        $error.hide();
    }
}

function validateCrateName($input, $error, $confirm) {
    var inputName = $.trim($input.val());
    var crates = $.map($('#crates > option'), function (el, i) {
        return $(el).attr('id');
    });
    var emptyName = function () {
        return (!inputName || /^\s*$/.test(inputName));
    };
    var existingName = function () {
        return crates.indexOf(inputName) > -1;
    };

    var regex = /[\/\\\<\>:\"\|?\*]/;

    if (existingName() || emptyName()) {
        $confirm.prop('disabled', true);
        if (emptyName()) {
            $error.text('Collection name cannot be blank');
        } else {
            $error.text('Collection with name "' + inputName + '" already exists');
        }
        $error.show();
    } else if (inputName.length > 128) {
        $error.text('Collection name has reached the limit of 128 characters');
        $input.val(inputName.substr(0, 128));
        $error.show();
        $confirm.prop('disabled', false);
    } else if (regex.test(inputName)) {
        $confirm.prop('disabled', true);
        $error.text("Invalid name. Illegal characters '\\', '/', '<', '>', ':', '\"', '|', '?' and '*' are not allowed");
        $error.show();
    } else {
        $confirm.prop('disabled', false);
        $error.hide();
    }
}

function validateItemName($input, $error, $confirm, $siblings) {
    var inputName = $.trim($input.val()).toLowerCase();
    var emptyName = function () {
        return (!inputName || /^\s*$/.test(inputName));
    };
    var items = $.map($siblings, function (el, i) {
        return el.name.toLowerCase();
    });
    var existingName = function () {
        return $.inArray(inputName, items) > -1;
    };
    var regex = /[\/\\\<\>:\"\|?\*]/;

    if (existingName() || emptyName()) {
        $confirm.prop('disabled', true);
        if (emptyName()) {
            $error.text('Item name cannot be blank');
        } else {
            $error.text('Item with name "' + inputName + '" already exists');
        }
        $error.show();
    } else if (inputName.length > 128) {
        $error.text('Item name has reached the limit of 128 characters');
        $input.val(inputName.substr(0, 128));
        $error.show();
        $confirm.prop('disabled', false);
    } else if (regex.test(inputName)) {
        $confirm.prop('disabled', true);
        $error.text("Invalid name. Illegal characters '\\', '/', '<', '>', ':', '\"', '|', '?' and '*' are not allowed");
        $error.show();
    } else {
        $confirm.prop('disabled', false);
        $error.hide();
    }
}

function reloadCrateData(crate) {
    updateCrateSize(crate);
    $('#files').remove();
    $('#container').after('<div id="files"></div>');
    $tree = buildFileTree(transformCrate(crate));
    indentTree();
    resetMetadataPanel();
    renderCrateMetadata(crate);
}

function truncateString(str, length) {
    return str.length > length ? str.substring(0, length - 3) + '...' : str
}

function calculateHeights() {
    var tabsHeight = ($('.panel-heading').outerHeight() * ($('.panel-heading').length + 1)) +
        $('.collapse.info.in .panel-body').outerHeight() + $('#legend').outerHeight();
    var height = $('#meta-data').innerHeight() - tabsHeight;
    $('.collapse.standard .panel-body').height(height + 12);
}

$(function () {
    $('#embargo_datetime_picker_button').datetimepicker();
});

/**
 * Resets the metadata panel in the crate UI
 */
function resetMetadataPanel() {
    $('#meta-data').html('');
}

/**
 * Remove a saved occurrence for a metadata group
 * @param metadataCategoryId - javascript id of metadata category
 * @param metadataGroupId - javascript id of the metadata group
 * @param groupOccurrenceId - javascript id of the metadata group occurrence
 */
function removeCrateMetadataGroupOccurrence(metadataCategoryId, metadataGroupId, groupOccurrenceId) {
    var c_url = OC.generateUrl('apps/collections/crate/delete_group_occurrence');
    var crateId = getSelectedCrateId();
    $.ajax({
        url: c_url,
        type: 'post',
        dataType: 'json',
        data: {
            'crate_id': crateId,
            'category_id': metadataCategoryId,
            'group_id': metadataGroupId,
            'group_occurrence_id': groupOccurrenceId
        },
        error: function (jqXHR) {
            displayError(jqXHR.responseJSON.msg);
        }
    });
}

/**
 * Remove a saved occurrence for a metadata field
 * @param metadataCategoryId - javascript id of metadata category
 * @param metadataGroupId - javascript id of the metadata group or null if not part of a group
 * @param groupOccurrenceId - javascript id of the metadata group occurrence or null if not part of a group
 * @param metadataFieldId - javascript id of text field
 * @param fieldOccurrenceId - javascript id of the text field occurrence
 */
function removeCrateMetadataFieldOccurrence(metadataCategoryId, metadataGroupId, groupOccurrenceId, metadataFieldId, fieldOccurrenceId) {
    var c_url = OC.generateUrl('apps/collections/crate/delete_occurrence');
    var crateId = getSelectedCrateId();
    $.ajax({
        url: c_url,
        type: 'post',
        dataType: 'json',
        data: {
            'crate_id': crateId,
            'category_id': metadataCategoryId,
            'group_id': metadataGroupId,
            'group_occurrence_id': groupOccurrenceId,
            'field_id': metadataFieldId,
            'field_occurrence_id': fieldOccurrenceId
        },
        error: function (jqXHR) {
            displayError(jqXHR.responseJSON.msg);
        }
    });
}

/**
 * Updates the saved occurrence value of a crate metadata field
 * @param metadataCategoryId - javascript id of metadata category
 * @param metadataGroupId - javascript id of the metadata group or null if not part of a group
 * @param groupOccurrenceId - javascript id of the metadata group occurrence or null if not part of a group
 * @param metadataFieldId - javascript id of text field
 * @param fieldOccurrenceId - javascript id of the text field occurrence
 * @param metadataValue - field value
 * @param saveCallback - callback to execute upon updating the crate metadata
 */
function updateCrateMetadataField(metadataCategoryId, metadataGroupId, groupOccurrenceId, metadataFieldId, fieldOccurrenceId, metadataValue, saveCallback) {
    var c_url = OC.generateUrl('apps/collections/crate/update_occurrence');
    var crateId = getSelectedCrateId();
    $.ajax({
        url: c_url,
        type: 'post',
        dataType: 'json',
        data: {
            'crate_id': crateId,
            'category_id': metadataCategoryId,
            'group_id': metadataGroupId,
            'group_occurrence_id': groupOccurrenceId,
            'field_id': metadataFieldId,
            'field_occurrence_id': fieldOccurrenceId,
            'value': metadataValue
        },
        success: function () {
            if (typeof saveCallback == 'function') {
                saveCallback();
            }
        },
        error: function (jqXHR) {
            displayError(jqXHR.responseJSON.msg);
        }
    });
}

/**
 * Renders the saved metadata of a crate, or if none is saved it requests and renders a default set of metadata
 * @param crate - crate containing the metadata
 */
function renderCrateMetadata (crate) {
    renderMetadata($.parseJSON(crate.metadataSchema), $.parseJSON(crate.savedMetadata));
}

/**
 * Renders the crate metadata
 * @param metadataSchema - crate metadata schema as JSON
 * @param savedMetadata - saved crate metadata values as JSON
 */
function renderMetadata(metadataSchema, savedMetadata) {
    metadataSchema.metadata_categories.forEach(function(metadataCategory) {
        var savedMetadataCategory = null;
        if (savedMetadata.hasOwnProperty('categories') && savedMetadata.categories.hasOwnProperty(metadataCategory.id)) {
            savedMetadataCategory = savedMetadata.categories[metadataCategory.id];
        }
        renderMetadataCategory(metadataCategory, savedMetadataCategory);
    });
}

/**
 * Renders a metadata category and all its metadata fields and groups
 * @param metadataCategory - schema metadata category as JSON
 * @param savedCategoryMetadata - saved metadata of this category as JSON or null if nothing saved
 */
function renderMetadataCategory(metadataCategory, savedCategoryMetadata) {
    appendMetadataCategory(metadataCategory.id, metadataCategory.display_name);
    metadataCategory.category_nodes.forEach(function(node) {
        if (node.type == 'metadata_field') {
            var metadataField = node[node.type];
            var savedMetadataField = null;
            if (savedCategoryMetadata != null && savedCategoryMetadata.fields.hasOwnProperty(metadataField.id)) {
                savedMetadataField = savedCategoryMetadata.fields[metadataField.id];
            }
            var categoryPanelBody = $('div#'+metadataCategory.id).children('div.panel-body');
            appendMetadataField(metadataCategory.id, null, null, categoryPanelBody, metadataField, savedMetadataField);
        } else if (node.type == 'metadata_group') {
            var metadataGroup = node[node.type];
            var savedMetadataGroup = null;
            if (savedCategoryMetadata != null && savedCategoryMetadata.groups.hasOwnProperty(metadataGroup.id)) {
                savedMetadataGroup = savedCategoryMetadata.groups[metadataGroup.id];
            }
            appendMetadataGroup(metadataCategory.id, metadataGroup, savedMetadataGroup)
        }
    });
}

/**
 * Renders a metadata category
 * @param categoryId - javascript id for the category
 * @param categoryDisplayName - UI display name for the category
 */
function appendMetadataCategory(categoryId, categoryDisplayName) {
    var panelHeading = '<div class="panel-heading"> ' +
            '<h4 class="panel-title">' +
                '<a data-toggle="collapse" data-parent="#meta-data" href="#'+categoryId+'" id="'+categoryId+'-head" class="collapsed">' +
                    categoryDisplayName +
                    '<i class="pull-right fa fa-caret-up"></i>' +
                '</a>' +
            '</h4>' +
        '</div>';
    var panelBody = '<div id="'+categoryId+'" class="panel-collapse collapse standard">' +
            '<div class="panel-body"></div>' +
        '</div>';
    $('div.panel-group#meta-data').append('<div class="panel panel-default">' + panelHeading + panelBody +  '</div>');
}

/**
 * Renders a metadata group within a category
 * @param categoryId - javascript id of the category to render the field within
 * @param groupMetadata - schema metadata group as JSON
 * @param savedGroupMetadata - saved metadata of this group as JSON or null if nothing saved
 */
function appendMetadataGroup(categoryId, groupMetadata, savedGroupMetadata) {
    var savedGroupOccurrences = null;
    if (savedGroupMetadata != null) {
        savedGroupOccurrences = savedGroupMetadata.occurrences;
    }
    var categoryPanelBody = $('div#'+categoryId).children('div.panel-body');
    generateMetadataGroup(groupMetadata, categoryPanelBody, categoryId, savedGroupOccurrences);
}

/**
 * Renders a metadata field within a category
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence to render the field within or null if not part of a group
 * @param panelBody - panel to append the metadata field to
 * @param fieldMetadata - schema metadata field as JSON
 * @param savedFieldMetadata - saved metadata of this field as JSON or null if nothing saved
 */
function appendMetadataField(categoryId, groupId, groupOccurrenceId, panelBody, fieldMetadata, savedFieldMetadata) {
    var savedFieldOccurrences = null;
    if (savedFieldMetadata != null) {
        savedFieldOccurrences = savedFieldMetadata.occurrences;
    }
    if (fieldMetadata.field.type == 'text_field') {
        generateTextField(fieldMetadata, panelBody, categoryId, groupId, groupOccurrenceId, savedFieldOccurrences);
    } else if (fieldMetadata.field.type == 'date_field') {
        generateDateField(fieldMetadata, panelBody, categoryId, groupId, groupOccurrenceId, savedFieldOccurrences);
    }
}

/**
 * Generates a unique-ish id comprised of the milliseconds elapsed since 1 January 1970 00:00:00 UTC concatenated
 *  with a seven digit random number. While it is possible for collisions to occur, the chance of this happening
 *  would be minimal.
 * @returns {number} - 13 digit unique-ish id
 */
function generateTimestampBasedId() {
   return Date.now() + Math.floor((Math.random()) * 0x1000000);
}

/**
 * Shows the add occurrence button for a given metadata field
 * @param panelBody - JQuery object corresponding to metadata category or group that the button is located in
 * @param nodeId - javascript id of the metadata node containing the button
 */
function showAddOccurrenceButton(panelBody, nodeId) {
    panelBody.find('#add_occurrence_'+nodeId).show();
}

/**
 * Hides the add occurrence button for a given metadata node
 * @param panelBody - JQuery object corresponding to the metadata category or group that the button is located in
 * @param nodeId - javascript id of the metadata node containing the button
 */
function hideAddOccurrenceButton(panelBody, nodeId) {
    panelBody.find('#add_occurrence_'+nodeId).hide();
}

/**
 * Removes the remove occurrence button for a given metadata field occurrence
 * @param panelBody - JQuery object corresponding to the metadata category or group that the button is located in
 * @param nodeId - javascript id of the metadata field containing the button
 * @param nodeOccurrenceId - javascript id of the metadata node occurrence the button corresponds to
 */
function removeRemoveOccurrenceButton(panelBody, nodeId, nodeOccurrenceId) {
    panelBody.find('div#'+nodeId+'_box').find('#remove_occurrence_'+nodeOccurrenceId).remove();
}

/**
 * Renders a metadata group within a category and adds associated event handlers
 * @param metadataGroup - metadata group as JSON
 * @param categoryPanelBody - JQuery object corresponding to metadata category panel to render the group within
 * @param categoryId - javascript id of the category to render the group within
 * @param savedGroupOccurrences - saved occurrences of this group as JSON or null if nothing saved
 */
function generateMetadataGroup(metadataGroup, categoryPanelBody, categoryId, savedGroupOccurrences) {
    var groupId = metadataGroup.id;
    var groupMinOccurrences = metadataGroup.min_occurs;
    var groupMaxOccurrences = metadataGroup.max_occurs;

    // Append header and body
    categoryPanelBody.append(generateMetadataGroupHTML(groupId, metadataGroup.display_name, metadataGroup.tooltip));
    if (groupMinOccurrences === groupMaxOccurrences) {
        hideAddOccurrenceButton(categoryPanelBody, groupId);
    }

    // Load saved values for initial and additional occurrences
    var groupBody = categoryPanelBody.find('div#'+groupId+'_box').find('div.group_body');
    if (savedGroupOccurrences != null) {
        var numGroupOccurrencesLoaded = 0;
        $.each(savedGroupOccurrences, function(groupOccurrenceId, groupOccurrenceNodes){
            addGroupOccurrence(categoryPanelBody, categoryId, groupId, groupOccurrenceId, metadataGroup.metadata_fields, groupOccurrenceNodes.fields);
            if (numGroupOccurrencesLoaded < groupMinOccurrences) {
                removeRemoveOccurrenceButton(categoryPanelBody, groupId, groupOccurrenceId)
            }
            numGroupOccurrencesLoaded++;
        });

        if (numGroupOccurrencesLoaded >= groupMaxOccurrences) {
            hideAddOccurrenceButton(categoryPanelBody, groupId);
        }
    }

    // Add minimum initial occurrences
    var numCurrentOccurrences = groupBody.find('.group_occurrence').length;
    for (var i = numCurrentOccurrences; i < groupMinOccurrences; i++) {
        var occurrenceId = addNewGroupOccurrence(categoryPanelBody, categoryId, groupId, metadataGroup.metadata_fields);
        removeRemoveOccurrenceButton(categoryPanelBody, groupId, occurrenceId);
    }

    // Attach event handling for adding additional occurrences
    categoryPanelBody.find('#add_occurrence_'+groupId).click(function(event) {
        var numCurrentOccurrences = groupBody.find('.group_occurrence').length;
        if (numCurrentOccurrences < groupMaxOccurrences) {
            addNewGroupOccurrence(categoryPanelBody, categoryId, groupId, metadataGroup.metadata_fields);
            if (numCurrentOccurrences + 1 >= groupMaxOccurrences) {
                hideAddOccurrenceButton(categoryPanelBody, groupId);
            }
        }
    });
}

/**
 * Adds a group occurrence with a generated id to the group body and attaches event handling
 * @param categoryPanelBody - JQuery object corresponding to metadata category panel to render the group within
 * @param categoryId - javascript id of the category to render the group within
 * @param groupId - javascript id of the group
 * @param metadataGroupFields - metadata group fields as JSON
 * @return String - the generated occurrence id
 */
function addNewGroupOccurrence(categoryPanelBody, categoryId, groupId, metadataGroupFields) {
    var groupOccurrenceId = groupId + '_' + generateTimestampBasedId();
    addGroupOccurrence(categoryPanelBody, categoryId, groupId, groupOccurrenceId, metadataGroupFields, null);
    return groupOccurrenceId;
}

/**
 * Adds a group occurrence with a specified id to the group body and attaches event handling
 * @param categoryPanelBody -  JQuery object corresponding to metadata category panel to render the group within
 * @param categoryId - javascript id of the category to render the group within
 * @param groupId - javascript id of the group
 * @param groupOccurrenceId - javascript id to use for the group occurrence
 * @param metadataGroupFields - metadata group fields as JSON
 * @param savedGroupOccurrenceFields - saved fields of this group occurrence as JSON or null if nothing saved
 */
function addGroupOccurrence(categoryPanelBody, categoryId, groupId, groupOccurrenceId, metadataGroupFields, savedGroupOccurrenceFields) {
    var groupBody = categoryPanelBody.find('div#'+groupId+'_box').find('div.group_body');
    groupBody.append(groupOccurrenceHTML(groupOccurrenceId));
    metadataGroupFields.forEach(function(field){
        var savedField = null;
        if (savedGroupOccurrenceFields != null) {
            savedField = savedGroupOccurrenceFields[field.id];
        }
        appendMetadataField(categoryId, groupId, groupOccurrenceId, groupBody.find('#occurrence_'+groupOccurrenceId),
            field, savedField);
    });

    // Add event handling for removing the group occurrence
    groupBody.find('#remove_occurrence_'+groupOccurrenceId).click(function(event){
        groupBody.find('#occurrence_'+groupOccurrenceId).remove();
        showAddOccurrenceButton(categoryPanelBody, groupId);
        removeCrateMetadataGroupOccurrence(categoryId, groupId, groupOccurrenceId);
    });
}

/**
 * Generates HTML to display a metadata group
 * @param groupId - id of the group
 * @param groupDisplayName - display name of metadata group
 * @param hoverHint - hover hint for tooltip
 * @return string - group as HTML
 */
function generateMetadataGroupHTML(groupId, groupDisplayName, hoverHint) {
    var addOccurrenceButton = '<button id="add_occurrence_'+groupId+'" class="pull-right trans-button" ' +
        'type="button" placeholder="Add occurrence" title="Add occurrence">' +
        '<i class="fa fa-plus-square-o"></i>' +
        '</button>';
    var tooltip = '';
    if (hoverHint != null) {
        tooltip = 'title="'+hoverHint+'"';
    }
    var groupHeader = '<h6 class="group_title" '+tooltip+'>'+ groupDisplayName + addOccurrenceButton +'</h6>';
    var groupBody = '<div class="group_body" style="overflow: hidden"></div>';
    return '<div id="'+groupId+'_box" class="metadata_group">' + groupHeader + groupBody +'</div>';
}

/**
 * Generates the HTML for a general metadata group occurrence
 * @param groupId - id of the group
 * @return string - group occurrence as HTML
 */
function groupOccurrenceHTML(groupId) {
    var removeOccurrenceButton = '<button id="remove_occurrence_'+groupId+'" class="pull-right trans-button remove-button" ' +
        'type="button" placeholder="Remove occurrence" title="Remove occurrence">' +
        '<i class="fa fa-minus-square-o"></i>' +
        '</button>';
    return '<div id="occurrence_'+groupId+'" class="group_occurrence">' + removeOccurrenceButton + '</div>';
}

/**
 * Renders a metadata text field within a category and adds associated event handlers
 * @param metadataField - metadata field as JSON
 * @param panelBody - JQuery object corresponding to metadata category or group to render the field within
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence to render the field within or null if not part of a group
 * @param savedFieldOccurrences - saved occurrences of this field as JSON or null if nothing saved
 */
function generateTextField(metadataField, panelBody, categoryId, groupId, groupOccurrenceId, savedFieldOccurrences) {
    var fieldId = metadataField.id;
    var fieldDisplayName = metadataField.display_name;
    var fieldPlaceholder = metadataField.field.text_field.placeholder;
    var fieldCharLimit = metadataField.field.text_field.char_limit;
    var fieldMinOccurrences = metadataField.min_occurs;
    var fieldMaxOccurrences = metadataField.max_occurs;
    var fieldDefaultValue = metadataField.field[metadataField.field.type].value;

    // Append field header and body
    panelBody.append(generateMetadataFieldHTML(fieldId, fieldDisplayName, metadataField.tooltip, metadataField.mandatory));
    if (fieldMinOccurrences === fieldMaxOccurrences) {
        hideAddOccurrenceButton(panelBody, fieldId);
    }

    // Load saved values for initial field and additional occurrences
    if (savedFieldOccurrences != null) {
        var numLoaded = 0;
        $.each(savedFieldOccurrences, function(fieldOccurrenceId, fieldOccurrenceValue){
            addTextFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId, fieldCharLimit, fieldPlaceholder, fieldDisplayName);
            setFieldOccurrenceValue(panelBody, fieldId, fieldOccurrenceId, fieldOccurrenceValue);
            if (numLoaded < fieldMinOccurrences) {
                removeRemoveOccurrenceButton(panelBody, fieldId, fieldOccurrenceId);
            }
            numLoaded++;
        });
        if (numLoaded >= fieldMaxOccurrences) {
            hideAddOccurrenceButton(panelBody, fieldId);
        }
    }

    // Add minimum initial occurrences
    var textFieldBody = panelBody.find('div#'+fieldId+'_box').find('div.field_body');
    var numCurrentOccurrences = textFieldBody.find('.field_occurrence').length;
    for (var i = numCurrentOccurrences; i < fieldMinOccurrences; i++) {
        var occurrenceId = addNewTextFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldCharLimit, fieldPlaceholder, fieldDisplayName);
        if (fieldDefaultValue != null) {
            saveFieldOccurrenceValue(textFieldBody.find('div#'+occurrenceId), fieldId, occurrenceId, categoryId, groupId, groupOccurrenceId, fieldDefaultValue);
        }
        removeRemoveOccurrenceButton(panelBody, fieldId, occurrenceId);
    }

    // Attach event handling for adding additional occurrences
    panelBody.find('#add_occurrence_'+fieldId).click(function(event) {
        var numCurrentOccurrences = textFieldBody.find('.field_occurrence').length;
        if (numCurrentOccurrences < fieldMaxOccurrences) {
            var newOccurrenceId = addNewTextFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldCharLimit, fieldPlaceholder, fieldDisplayName);
            if (fieldDefaultValue != null) {
                saveFieldOccurrenceValue(textFieldBody.find('div#'+newOccurrenceId), fieldId, newOccurrenceId, categoryId, groupId, groupOccurrenceId, fieldDefaultValue);
            }
            if (numCurrentOccurrences + 1 >= fieldMaxOccurrences) {
                hideAddOccurrenceButton(panelBody, fieldId);
            }
        }
    });
}


/**
 * Adds a text field occurrence with a generated id to the field body and attaches event handling
 * @param panelBody - JQuery object corresponding to metadata category or group to render the field within
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence the field belongs to or null if not part of a group
 * @param fieldId - javascript id of text field
 * @param fieldCharLimit - text field character limit
 * @param fieldPlaceholder - placeholder text for text field
 * @param fieldDisplayName - display name of text field
 * @return String - the generated occurrence id
 */
function addNewTextFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldCharLimit, fieldPlaceholder, fieldDisplayName) {
    var fieldOccurrenceId = fieldId + '_' + generateTimestampBasedId();
    addTextFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId, fieldCharLimit, fieldPlaceholder, fieldDisplayName);
    return fieldOccurrenceId;
}

/**
 * Adds a text field occurrence with a specified id to the field body and attaches event handling
 * @param panelBody - JQuery object corresponding to metadata category or group to render the field within
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence the field belongs to or null if not part of a group
 * @param fieldId - javascript id of text field
 * @param fieldOccurrenceId - javascript id to use for the text field occurrence
 * @param fieldCharLimit - text field character limit
 * @param fieldPlaceholder - placeholder text for text field
 * @param fieldDisplayName - display name of text field
 */
function addTextFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId, fieldCharLimit, fieldPlaceholder, fieldDisplayName) {
    var textFieldBody = panelBody.find('div#'+fieldId+'_box').find('div.field_body');
    textFieldBody.append(fieldOccurrenceHTML(fieldOccurrenceId));

    // Add event handling for editing the text field occurrence
    var textField = textFieldBody.find('div#'+fieldOccurrenceId);
    textFieldBody.find('#edit_'+fieldOccurrenceId).click(function(event){
        $('#edit_'+fieldOccurrenceId).attr('disabled',true);
        var oldText = textField.text();
        textField.text('');
        var textArea = '<textarea id="input_'+fieldOccurrenceId+'"';
        if (fieldCharLimit != null) {
            textArea += ' maxlength="'+fieldCharLimit+'"';
        }
        textArea += ' style="width: 40%;" placeholder="'+fieldPlaceholder+'">' + oldText + '</textarea>';
        textField.html(textArea + '<br/>' +
            '<div id="edit_'+fieldOccurrenceId+'_validation_error" style="color:red"></div>' +
            '<input id="save_'+fieldOccurrenceId+'" type="button" value="Save" />' +
            '<input id="cancel_'+fieldOccurrenceId+'" type="button" value="Cancel" />');

        attachFieldSaveEvent(textField, fieldId, fieldOccurrenceId, categoryId, groupId, groupOccurrenceId);
        attachFieldCancelEvent(textField, fieldOccurrenceId, oldText);
        attachTextFieldValidation(textField, fieldCharLimit, fieldOccurrenceId, fieldDisplayName);
    });

    // Add event handling for removing the text field occurrence
    textFieldBody.find('#remove_occurrence_'+fieldOccurrenceId).click(function(event){
        textFieldBody.find('#occurrence_'+fieldOccurrenceId).remove();
        showAddOccurrenceButton(panelBody, fieldId);
        removeCrateMetadataFieldOccurrence(categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId);
    });
}

/**
 * Attaches event handling for saving an edit to a field occurrence value
 * @param fieldDiv - div holding field occurrence edit box and saved value
 * @param fieldId - javascript id of text field
 * @param occurrenceId - javascript id of the field occurrence
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence the field belongs to or null if not part of a group
 */
function attachFieldSaveEvent(fieldDiv, fieldId, occurrenceId, categoryId, groupId, groupOccurrenceId) {
    fieldDiv.find('#save_'+occurrenceId).click(function(event) {
        var newValue = fieldDiv.find('#input_'+occurrenceId).val();
        saveFieldOccurrenceValue(fieldDiv, fieldId, occurrenceId, categoryId, groupId, groupOccurrenceId, newValue);
    });
}

/**
 * Saves the value of a field occurrence to a crate
 * @param fieldDiv - div holding field occurrence edit box and saved value
 * @param fieldId - id of the metadata field
 * @param occurrenceId - id of the field occurrence
 * @param categoryId - id of the category the field belongs to
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence the field belongs to or null if not part of a group
 * @param newValue - value of the field occurrence
 */
function saveFieldOccurrenceValue(fieldDiv, fieldId, occurrenceId, categoryId, groupId, groupOccurrenceId, newValue) {
    function saveCallback() {
        fieldDiv.html('');
        fieldDiv.text(newValue);
        calculateHeights();
    }
    updateCrateMetadataField(categoryId, groupId, groupOccurrenceId, fieldId, occurrenceId, newValue, saveCallback);
    fieldDiv.find('#edit_'+occurrenceId).removeClass('hidden');
    $('#edit_'+occurrenceId).attr('disabled',false);
}

/**
 * Attaches event handling for cancelling an edit to a field occurrence value
 * @param fieldDiv - div holding field occurrence edit box and saved value
 * @param occurrenceId - javascript id of text field occurrence
 * @param previousValue - original occurrence value before edit
 */
function attachFieldCancelEvent(fieldDiv, occurrenceId, previousValue) {
    fieldDiv.find('#cancel_'+occurrenceId).click(function(event) {
        fieldDiv.html('');
        fieldDiv.text(previousValue);
        fieldDiv.find('#edit_'+occurrenceId).removeClass('hidden');
        $('#edit_'+occurrenceId).attr('disabled',false);
    });
}

/**
 * Attaches event handling for clearing an edit to a field occurrence value
 * @param fieldDiv - div holding field occurrence edit box and saved value
 * @param occurrenceId - javascript id of text field occurrence
 */
function attachFieldClearEvent(fieldDiv, occurrenceId) {
    fieldDiv.find('#clear_'+occurrenceId).click(function() {
        fieldDiv.find('#input_' + occurrenceId).val('');
    });
}


/**
 * Attaches event handling for character limit validation to a text field
 * @param textField - div holding text field edit box and saved text
 * @param charLimit - text field character limit
 * @param occurrenceId - javascript id of text field occurrence
 * @param fieldDisplayName - display name of text field
 */
function attachTextFieldValidation(textField, charLimit, occurrenceId, fieldDisplayName) {
    if (charLimit != null) {
        textField.find('#input_' + occurrenceId).keyup(function () {
            var error = textField.find('#edit_' + occurrenceId + '_validation_error');
            if ($(this).val().length >= charLimit) {
                error.text(fieldDisplayName + ' has reached the limit of ' + charLimit + ' characters');
                error.show();
                $(this).val($(this).val().substr(0, charLimit));
            } else {
                error.text('');
            }
        });
    }
}

/**
 * Generates HTML to display a metadata field
 * @param fieldId - id of the field
 * @param fieldDisplayName - display name of metadata field
 * @param hoverHint - hover hint for tooltip
 * @param isRequired - True if field is required/mandatory, false otherwise
 * @return string - field as HTML
 */
function generateMetadataFieldHTML(fieldId, fieldDisplayName, hoverHint, isRequired) {
    var addOccurrenceButton = '<button id="add_occurrence_'+fieldId+'" class="pull-right trans-button" ' +
        'type="button" placeholder="Add occurrence" title="Add occurrence">' +
        '<i class="fa fa-plus-square-o"></i>' +
        '</button>';
    var tooltip = '';
    if (hoverHint != null) {
        tooltip = 'title="'+hoverHint+'"';
    }
    var requiredIndicator = '';
    if (isRequired) {
        requiredIndicator = '<span class="required"> *</span>'
    }
    var fieldHeader = '<h6 class="field_title" '+tooltip+'>'+ fieldDisplayName + requiredIndicator + addOccurrenceButton +'</h6>';
    var fieldBody = '<div class="field_body" style="overflow: hidden"></div>';
    return '<div id="'+fieldId+'_box" class="metadata_field">' + fieldHeader + fieldBody +'</div>';
}

/**
 * Generates the HTML for a general metadata field occurrence
 * @param fieldId - id of the field
 * @return string - field occurrence as HTML
 */
function fieldOccurrenceHTML(fieldId) {
    var editButton = '<button id="edit_'+fieldId+'" class="pull-right trans-button edit-button" type="button" placeholder="Edit">' +
        '<i class="fa fa-edit"></i>' +
        '</button>';
    var removeOccurrenceButton = '<button id="remove_occurrence_'+fieldId+'" class="pull-right trans-button remove-button" ' +
        'type="button" placeholder="Remove occurrence" title="Remove occurrence">' +
        '<i class="fa fa-minus-square-o"></i>' +
        '</button>';
    return '<div id="occurrence_'+fieldId+'" class="field_occurrence">' +
        removeOccurrenceButton + editButton +
        '<div id="'+fieldId+'" style="white-space: pre-wrap;" class="metadata field_value"></div>' +
        '</div>';
}

/**
 * Sets the value of a field occurrence
 * @param panelBody - JQuery object corresponding to metadata category or group containing the field
 * @param fieldId - javascript id of the metadata field
 * @param fieldOccurrenceId - javascript id of the metadata field occurrence
 * @param value - value to set the field occurrence to
 */
function setFieldOccurrenceValue(panelBody, fieldId, fieldOccurrenceId, value) {
    panelBody.find('div#'+fieldId+'_box').find('div.field_body').find('div#'+fieldOccurrenceId).text(value);
}

/**
 * Renders a metadata date field within a category and adds associated event handlers
 * @param metadataField - metadata field as JSON
 * @param panelBody - JQuery object corresponding to metadata category or group to render the field within
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence to render the field within or null if not part of a group
 * @param savedFieldOccurrences - saved occurrences of this field as JSON or null if nothing saved
 */
function generateDateField(metadataField, panelBody, categoryId, groupId, groupOccurrenceId, savedFieldOccurrences) {
    var fieldId = metadataField.id;
    var fieldDisplayName = metadataField.display_name;
    var fieldTooltip = metadataField.tooltip;
    var fieldMaxDate = metadataField.field.date_field.max_date;
    var fieldMinOccurrences = metadataField.min_occurs;
    var fieldMaxOccurrences = metadataField.max_occurs;
    var fieldDefaultValue = metadataField.field[metadataField.field.type].value;
    if (fieldDefaultValue == "today") {
        fieldDefaultValue = moment().format("YYYY-MM-DD");
    }

    // Append field header and body
    panelBody.append(generateMetadataFieldHTML(fieldId, fieldDisplayName, fieldTooltip, metadataField.mandatory));
    if (fieldMinOccurrences === fieldMaxOccurrences) {
        hideAddOccurrenceButton(panelBody, fieldId);
    }

    // Load saved values for initial field and additional occurrences
    if (savedFieldOccurrences != null) {
        var numLoaded = 0;
        $.each(savedFieldOccurrences, function(fieldOccurrenceId, fieldOccurrenceValue){
            addDateFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId, fieldMaxDate);
            setFieldOccurrenceValue(panelBody, fieldId, fieldOccurrenceId, fieldOccurrenceValue);
            if (numLoaded < fieldMinOccurrences) {
                removeRemoveOccurrenceButton(panelBody, fieldId, fieldOccurrenceId);
            }
            numLoaded++;
        });
        if (numLoaded >= fieldMaxOccurrences) {
            hideAddOccurrenceButton(panelBody, fieldId);
        }
    }

    // Add minimum initial occurrences
    var dateFieldBody = panelBody.find('div#'+fieldId+'_box').find('div.field_body');
    var numCurrentOccurrences = dateFieldBody.find('.field_occurrence').length;
    for (var i = numCurrentOccurrences; i < fieldMinOccurrences; i++) {
        var occurrenceId = addNewDateFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldMaxDate);
        if (fieldDefaultValue != null) {
            saveFieldOccurrenceValue(dateFieldBody.find('div#'+occurrenceId), fieldId, occurrenceId, categoryId, groupId, groupOccurrenceId, fieldDefaultValue);
        }
        removeRemoveOccurrenceButton(panelBody, fieldId, occurrenceId);
    }

    // Attach event handling for adding additional occurrences
    panelBody.find('#add_occurrence_'+fieldId).click(function(event) {
        var numCurrentOccurrences = dateFieldBody.find('.field_occurrence').length;
        if (numCurrentOccurrences < fieldMaxOccurrences) {
            var newOccurrenceId = addNewDateFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldMaxDate);
            if (fieldDefaultValue != null) {
                saveFieldOccurrenceValue(dateFieldBody.find('div#'+newOccurrenceId), fieldId, newOccurrenceId, categoryId, groupId, groupOccurrenceId, fieldDefaultValue);
            }
            if (numCurrentOccurrences + 1 >= fieldMaxOccurrences) {
                hideAddOccurrenceButton(panelBody, fieldId);
            }
        }
    });
}

/**
 * Adds a date field occurrence with a generated id to the field body and attaches event handling
 * @param panelBody - JQuery object corresponding to metadata category or group to render the field within
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence the field belongs to or null if not part of a group
 * @param fieldId - javascript id of date field
 * @param fieldMaxDate - maximum date permitted when selecting a date
 * @return String - the generated occurrence id
 */
function addNewDateFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldMaxDate) {
    var fieldOccurrenceId = fieldId + '_' + generateTimestampBasedId();
    addDateFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId, fieldMaxDate);
    return fieldOccurrenceId;
}

/**
 * Adds a date field occurrence with a specified id to the field body and attaches event handling
 * @param panelBody - JQuery object corresponding to metadata category or group to render the field within
 * @param categoryId - javascript id of the category to render the field within
 * @param groupId - id of the group which the field belongs to or null if not part of a group
 * @param groupOccurrenceId - id of the group occurrence the field belongs to or null if not part of a group
 * @param fieldId - javascript id of text field
 * @param fieldOccurrenceId - javascript id to use for the text field occurrence
 * @param fieldMaxDate - maximum date permitted when selecting a date
 */
function addDateFieldOccurrence(panelBody, categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId, fieldMaxDate) {
    var dateFieldBody = panelBody.find('div#'+fieldId+'_box').find('div.field_body');
    dateFieldBody.append(fieldOccurrenceHTML(fieldOccurrenceId));

    // Add event handling for editing the text field occurrence
    var tooltip = 'The date must be less than or equal to ' + moment(fieldMaxDate, 'YYYY-MM-DD').format('Do MMMM YYYY');
    var dateField = dateFieldBody.find('div#'+fieldOccurrenceId);
    dateFieldBody.find('#edit_'+fieldOccurrenceId).click(function(event){
        $('#edit_'+fieldOccurrenceId).attr('disabled',true);
        var oldDate = dateField.text();
        dateField.text('');
        var dateDiv = '<div class="input-append date" id = "date_picker_button">';
        var dateArea = '<input id="input_'+fieldOccurrenceId+'" type="text" data-format="yyyy-MM-dd" disabled="disabled"/>';
        var pickDateButton = '<span class = "add-on">' +
                '<i id="datepicker_'+fieldOccurrenceId+'" class="fa fa-calendar datetime_icon" title="'+tooltip+'"></i>' + '</span>';
        dateField.html(dateDiv +
            dateArea +
            pickDateButton +
            '<br/>' +
            '<div id="edit_'+fieldOccurrenceId+'_validation_error" style="color:red"></div>' +
            '</div>' +
            '<input id="save_'+fieldOccurrenceId+'" type="button" value="Save" />' +
            '<input id="clear_'+fieldOccurrenceId+'" type="button" value="Clear" />' +
            '<input id="cancel_'+fieldOccurrenceId+'" type="button" value="Cancel" />'
        );
        $('#input_'+fieldOccurrenceId).val(oldDate);
        $('#date_picker_button').datetimepicker();
        attachFieldSaveEvent(dateField, fieldId, fieldOccurrenceId, categoryId, groupId, groupOccurrenceId);
        attachFieldCancelEvent(dateField, fieldOccurrenceId, oldDate);
        attachFieldClearEvent(dateField, fieldOccurrenceId);
    });

    // Add event handling for removing the date field occurrence
    dateFieldBody.find('#remove_occurrence_'+fieldOccurrenceId).click(function(event){
        dateFieldBody.find('#occurrence_'+fieldOccurrenceId).remove();
        showAddOccurrenceButton(panelBody, fieldId);
        removeCrateMetadataFieldOccurrence(categoryId, groupId, groupOccurrenceId, fieldId, fieldOccurrenceId);
    });
}
