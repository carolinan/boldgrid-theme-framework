/* eslint-disable */
import WidgetSectionUpdate from './widget/section-update';
import BlogPagePanelExpand from './design/blog/blog-page/panel-expand.js';
import BlogPostsPanelExpand from './design/blog/posts/panel-expand.js';
import HomepageSectionExpand from './design/homepage/section-expand.js';
import { Control as GenericControls } from './generic/control.js';
import { Required } from './required.js';
import SectionExtendTitle from './menus/extend-title';
import HamburgerControlToggle from './menus/hamburger-control-toggle';
import HoverBackgroundToggle from './menus/hover-background-toggle';
import { Locations as MenuLocations } from './menus/locations';
import { Devices } from './devices';
import camelCase from 'lodash.camelcase';
import kebabCase from 'lodash.kebabcase';
import startCase from 'lodash.startcase';

let devices = new Devices();
devices.init();

( function( $ ) {
	var api, _panelEmbed, _panelIsContextuallyActive, _panelAttachEvents, _sectionEmbed, _sectionIsContextuallyActive, _sectionAttachEvents;

	api = wp.customize;
	new Required().init();
	new WidgetSectionUpdate().init();
	new BlogPagePanelExpand();
	new BlogPostsPanelExpand();
	new HomepageSectionExpand();
	new SectionExtendTitle();
	new GenericControls().init();
	new HamburgerControlToggle();
	new HoverBackgroundToggle();
	new MenuLocations();

	api.bind( 'pane-contents-reflowed', function() {
		var sections, panels;

		// Reflow sections.
		sections = [];

		api.section.each( function( section ) {
			if ( 'bgtfw_section' !== section.params.type || 'undefined' === typeof section.params.section ) {
				return;
			}

			sections.push( section );
		} );

		sections.sort( api.utils.prioritySort ).reverse();

		$.each( sections, function( i, section ) {
			var parentContainer = $( '#sub-accordion-section-' + section.params.section );
			parentContainer.children( '.section-meta' ).after( section.headContainer );
		} );

		// Reflow panels.
		panels = [];

		api.panel.each( function( panel ) {
			if ( 'bgtfw_panel' !== panel.params.type || 'undefined' === typeof panel.params.panel ) {
				return;
			}

			panels.push( panel );
		} );

		panels.sort( api.utils.prioritySort ).reverse();

		$.each( panels, function( i, panel ) {
			var parentContainer = $( '#sub-accordion-panel-' + panel.params.panel );
			parentContainer.children( '.panel-meta' ).after( panel.headContainer );
		} );

		// Handle home icon click.
		$( '.customize-action > .dashicons-admin-home, .preview-notice > .dashicons-admin-home' ).on( 'click', function( event ) {
			var baseId,
				el = event.delegateTarget,
				links = $( $( el ).siblings( 'a' ) ).get().reverse();

			_.each( links, function( link ) {
				if ( _.isFunction( link.onclick ) ) {
					link.onclick.call( link, event );
				}
			} );

			// Detect if whatever is currently open is a section or panel.
			if ( $( '.control-panel-bgtfw_panel.current-panel' ).length ) {
				baseId = $( '.control-panel-bgtfw_panel.current-panel' );
				baseId = baseId.attr( 'id' ).replace( 'sub-accordion-panel-', '' );
				if ( wp.customize.panel( baseId ) ) {
					wp.customize.panel( baseId ).collapse();
				}
			} else if ( $( '.control-section-bgtfw_section.open' ).length ) {
				baseId = $( '.control-section-bgtfw_section.open' );
				baseId = baseId.attr( 'id' ).replace( 'sub-accordion-section-', '' );
				if ( wp.customize.section( baseId ) ) {
					wp.customize.section( baseId ).collapse();
				}
			}
		} );
	} );


	// Extend Panel.
	_panelEmbed = wp.customize.Panel.prototype.embed;
	_panelIsContextuallyActive = wp.customize.Panel.prototype.isContextuallyActive;
	_panelAttachEvents = wp.customize.Panel.prototype.attachEvents;

	wp.customize.Panel = wp.customize.Panel.extend( {
		attachEvents: function() {
			var panel;

			if ( 'bgtfw_panel' !== this.params.type || 'undefined' === typeof this.params.panel ) {
				_panelAttachEvents.call( this );
				return;
			}

			_panelAttachEvents.call( this );

			panel = this;

			panel.expanded.bind( function( expanded ) {
				var parent = api.panel( panel.params.panel );
				expanded ? parent.contentContainer.addClass( 'current-panel-parent' ) : parent.contentContainer.removeClass( 'current-panel-parent' );
			} );

			panel.container.find( '.customize-panel-back' )
				.off( 'click keydown' )
				.on( 'click keydown', function( event ) {
					if ( api.utils.isKeydownButNotEnterEvent( event ) ) {
						return;
					}

					// Keep this AFTER the key filter above
					event.preventDefault();

					if ( panel.expanded() ) {
						api.panel( panel.params.panel ).expand();
					}
				} );
		},
		embed: function() {
			var panel, parentContainer;

			if ( 'bgtfw_panel' !== this.params.type || 'undefined' === typeof this.params.panel ) {
				_panelEmbed.call( this );

				return;
			}

			_panelEmbed.call( this );

			panel = this;
			parentContainer = $( '#sub-accordion-panel-' + this.params.panel );

			parentContainer.append( panel.headContainer );
		},
		isContextuallyActive: function() {
			var panel, children, activeCount;

			if ( 'bgtfw_panel' !== this.params.type ) {
				return _panelIsContextuallyActive.call( this );
			}

			panel = this;
			children = this._children( 'panel', 'section' );

			api.panel.each( function( child ) {
				if ( ! child.params.panel || ( child.params.panel !== panel.id ) ) {
					return;
				}

				children.push( child );
			} );

			children.sort( api.utils.prioritySort );

			activeCount = 0;

			_( children ).each( function( child ) {
				if ( child.active() && child.isContextuallyActive() ) {
					activeCount += 1;
				}
			} );

			return ( 0 !== activeCount );
		},

		/**
		 * Collapse all child sections.
		 *
		 * @since 2.0.0
		 */
		collapseChildren: function() {
			var children = this._children( 'panel', 'section' );

			_( children ).each( function( child ) {
				if ( child.expanded() ) {
					child.collapse();
				}
			} );
		},

		/**
		 * Wrapper function for the focus() method.
		 *
		 * Because of nested panels, the focus() method does not always work. If you're in a nested
		 * section, it won't focus on the parent panel correctly.
		 *
		 * @since 2.0.0
		 */
		bgtfwFocus: function() {
			var panel = this;

			if ( panel.expanded() ) {
				panel.collapseChildren();
			} else {
				panel.focus();
			}
		}
	} );

	/**
	 * Override the render font selector method to display font images.
	 */
	wp.customize.controlConstructor['kirki-typography'] = wp.customize.controlConstructor['kirki-typography'].extend( {
		renderFontSelector: function() {

			// Call parent method.
			wp.customize.controlConstructor['kirki-typography']
				.__super__
				.renderFontSelector
				.apply( this, arguments );

			// Selecting the instance will add the needed attributes, don't ask why.
			$( this.selector + ' .font-family select' ).selectWoo();
		}
	} );

	wp.customize.controlConstructor['bgtfw-menu-hamburgers'] = wp.customize.Control.extend( {
		ready: function() {
			var control = this;

			control.container.find( '.bgtfw-hamburger-col, .tray, input' ).on( 'click touchend', function( e ) {
				var col = $( e.target ).find( '.bgtfw-hamburger-col' );
				if ( ! col.length ) {
					col = $( e.target ).closest( '.bgtfw-hamburger-col' );
				}
				control.container.find( '.bgtfw-hamburger-col' ).removeClass( 'hamburger-selected' );
				col.addClass( 'hamburger-selected' );
			} );

			control.container.find( '.bgtfw-hamburger-col' ).on( 'mouseover', function( e ) {
				$( e.target ).find( '.hamburger' ).addClass( 'is-active' );
			} );
			control.container.find( '.bgtfw-hamburger-col' ).on( 'mouseout', function( e ) {
				$( e.target ).find( '.hamburger' ).removeClass( 'is-active' );
			} );
		}
	} );

	wp.customize.controlConstructor['bgtfw-sortable-accordion'] = wp.customize.Control.extend( {

		/**
		 * Handles the control's initialization.
		 *
		 * @since 2.0.3
		 */
		ready: function() {
			this.setSelectQueue();
			this.setSortable();
			this.addSortables();
			this.addTypes();
			this.addRepeaterControls();
			this.updateTitles();
			this.updateAddTypes();
			this.addEvents();
		},
		/**
		 * Sets select queue for connected controls.
		 *
		 * @since 2.0.3
		 */
		setSelectQueue() {
			return this.selectQueue = 0;
		},

		/**
		 * Sets a reference to the sortable selector to the parent sortable to use.
		 *
		 * @since 2.0.3
		 */
		setSortable() {
			return this.sortable = this.container.find( `#sortable-${ this.id }` );
		},

		/**
		 * Initializes sortables.
		 *
		 * @since 2.0.3
		 */
		addSortables() {
			this.addPrimarySortables();
			this.addRepeaterSortables();
		},

		/**
		 * Adds primary container sortables.
		 *
		 * @since 2.0.3
		 */
		addPrimarySortables() {
			this.sortable.accordion( {
				header: '> .sortable-wrapper > .sortable-title',
				heightStyle: 'content',
				collapsible: true,
				active: false
			} ).sortable( {
				update: this.updateValues.bind( this )
			} ).disableSelection();
		},

		/**
		 * Adds repeater container sortables.
		 *
		 * @since 2.0.3
		 */
		addRepeaterSortables() {
			this.container.find( '.connected-sortable' ).accordion( {
				header: '.repeater-handle',
				heightStyle: 'content',
				collapsible: true,
				active: false
			} ).sortable( {
				update: this.updateValues.bind( this )
			} ).disableSelection();
		},

		/**
		 * Adds the additional event handlers used in the sortable control.
		 *
		 * @since 2.0.3
		 */
		addEvents() {
			api.bind( 'ready',() => {
				$( api.OuterSection.prototype.containerParent ).on( 'bgtfw-menu-dropdown-select', _.after( this.getConnectedMenus().length, this.updateConnectedSelects( true ) ) );
				this.sortable
					.on( 'click', '.bgtfw-sortable:not(.disabled)', e => this._addItem( e ) )
					.on( 'click', '.bgtfw-container-control > .bgtfw-sortable-control:not(.selected), .repeater-control.align .direction:not(.selected)', e => this._select( e ) )
					.on( 'click', '.dashicons-trash', e => this._deleteItem( e ) )
					.on( 'change', '.repeater-control.menu-select', e => this._updateMenuSelect( e ) )
					.on( 'click', '.repeater-control.align .direction:not(.selected)', e => this._updateAlignment( e ) )
					.on( 'change', '.repeater-control.attribution', e => this._updateAttribution( e ) );
				$( `#sortable-${ this.id }-add-section` ).on( 'click', ( e ) => this.addSection( e ) );
			} );
		},

		/**
		 * Add new section to sortable event handler.
		 *
		 * @since 2.0.3
		 */
		addSection( e ) {
			e.preventDefault();
			this.container.find( '.connected-sortable' ).sortable( 'destroy' );
			let items = this.sortable.find( '.sortable-wrapper' );
			let newItem = items.last().clone( true );
			newItem.attr( 'id', `sortable-${ items.length }-wrapper` );
			newItem.find( '.connected-sortable' ).attr( 'id', `sortable-${ this.id }-${ items.length }` );
			newItem.find( '.connected-sortable li' ).remove();
			newItem.appendTo( this.sortable );
			this.addRepeaterSortables();
			this.refreshItems();
			this.updateValues();
		},

		/**
		 * Repeater's delete item event handler.
		 *
		 * @since 2.0.3
		 */
		_deleteItem( e ) {
			$( e.currentTarget ).closest( '.ui-sortable-handle' ).remove();
			this.updateValues();
		},

		/**
		 * Menu item type's dropdown event handler.
		 *
		 * @since 2.0.3
		 */
		_updateMenuSelect( e ) {
			let el = e.currentTarget,
				repeater = $( el ).closest( '.repeater' )[0];

			// Update repeater's dataset.
			repeater.dataset.type = el.value;
			this.updateValues();

			// Update the menu select controls' disabled items.
			this.updateConnectedSelects();
		},

		/**
		 * Update menu select controls.
		 *
		 * @since 2.0.3
		 */
		updateConnectedSelects( queued ) {
			let unqueued = _.isUndefined( queued ),
				containers = [],
				instance,
				menus;

			if ( ! unqueued ) {
				this.getLastConnected().selectQueue += 1;
			}

			if ( unqueued || this.getLastConnected().selectQueue >= this.getConnectedControls().length ) {
				menus = this.getConnectedMenus();
				_.each( this.getConnectedControls(), control => {
					instance = this.id === control.id ? this : api.control( control.id );
					if ( ! _.isUndefined( instance ) ) {
						containers.push( instance.selector );
					}
				} );

				containers = containers.map( container => `${ api.OuterSection.prototype.containerParent } ${ container } .repeater-control.menu-select option` ).join( ', ' );
				document.querySelectorAll( containers ).forEach( option => {
					let repeater = $( option ).closest( '.repeater' )[0].dataset.type;
					option.disabled = menus.includes( option.value ) && repeater !== option.value ? true : false;
				} );

				this.selectQueue = 0;
			}

		},

		/**
		 * Alignment controls' event handler.
		 *
		 * @since 2.0.3
		 */
		_updateAlignment( e ) {
			let el = e.currentTarget,
				repeater = $( el ).closest( '.repeater' )[0],
				newVal = el.className.replace( /direction|selected|\s/g, '' );

			repeater.dataset.align = newVal;
			this.updateValues();
		},

		/**
		 * Adds any of the needed controls for the repeaters.
		 *
		 * @since 2.0.3
		 */
		addRepeaterControls( cancelled = false ) {
			let repeaters = this.sortable.find( '.repeater' ),
				addedSelect = _.after( this.getUsedMenuActions().length, () => $( api.OuterSection.prototype.containerParent ).trigger( 'bgtfw-menu-dropdown-select' ) );

			_.each( repeaters, repeater => {
				let repeaterControls = repeater.querySelector( '.repeater-accordion-content' ),
					controls = this.params.items[ repeater.dataset.key ].controls || {},
					setting;

				_.each( controls, ( control, key ) => {
					if ( ! repeater.querySelector( `.repeater-control.${ kebabCase( key ) }` ) ) {
						setting = repeater.dataset[ key ] || control.defaults || repeater.dataset.type;
						repeaterControls.innerHTML += this[ camelCase( `Get ${ key } Markup` ) ]( setting );
						if ( key === 'menu-select' ) {
							cancelled ? this.updateConnectedSelects() : addedSelect;
						}
					}
				} );
			} );
		},

		/**
		 * Attribution controls' event handler.
		 *
		 * @since 2.0.3
		 */
		_updateAttribution( e ) {
			api( e.target.dataset.attribution ).set( e.target.checked );
		},

		/**
		 * Gets the attribution control's markup.
		 *
		 * @since 2.0.3
		 */
		getAttributionMarkup() {
			let markup = '<div class="repeater-control attribution"><ul>';

			_.each( this.getAttributionSettings(), setting => {
				let id = _.uniqueId( `${ setting.id }_` ),
					checked = api( setting.id )() ? 'checked' : '';

				markup += `<li>
					<input id="${ id }" class="attribution-link" type="checkbox" data-attribution="${ setting.id }" ${ checked }>
					<label for="${ id }">${ startCase( setting.id ) }</label>
				</li>`;
			} );

			markup += '</ul></div>'

			return markup;
		},

		/**
		 * Gets the alignment control's markup.
		 *
		 * @since 2.0.3
		 */
		getAlignMarkup( align ) {
			let markup = `
			<div class="repeater-control align">
				<div class="align-wrapper">
					<div class="repeater-control-title">Alignment</div>
					<div class="direction nw">
						<span class="dashicons dashicons-arrow-up"></span>
					</div>
					<div class="direction n">
						<span class="dashicons dashicons-arrow-up"></span>
					</div>
					<div class="direction ne">
						<span class="dashicons dashicons-arrow-up"></span>
					</div>
					<div class="direction w">
						<span class="dashicons dashicons-arrow-left"></span>
					</div>
					<div class="direction c">
						<span class="dashicons dashicons-marker"></span>
					</div>
					<div class="direction e">
						<span class="dashicons dashicons-arrow-right"></span>
					</div>
					<div class="direction sw">
						<span class="dashicons dashicons-arrow-down"></span>
					</div>
					<div class="direction s">
						<span class="dashicons dashicons-arrow-down"></span>
					</div>
					<div class="direction se">
						<span class="dashicons dashicons-arrow-down"></span>
					</div>
				</div>
			</div>`;

			markup = markup.replace( `"direction ${ align }"`, `"direction ${ align } selected"` );

			return markup;
		},

		/**
		 * Gets the sidebar edit button markup.
		 *
		 * @since 2.0.3
		 */
		getSidebarEditMarkup( type ) {
			let id = type.replace( 'bgtfw_sidebar_', '' );
			return `<div class="repeater-control sidebar-edit">
				<p class="repeater-control-description">Edit sidebar widgets and appearance in "Widgets" section.</p>
				<a class="button-primary" href="#" onclick="event.preventDefault(); wp.customize.section( 'sidebar-widgets-${ id }' ).focus();"><i class="dashicons dashicons-edit"></i>Edit Sidebar</a>
			</div>`;
		},

		/**
		 * Gets the menu item type's dropdown menu.
		 *
		 * @since 2.0.3
		 */
		getMenuSelectMarkup( type ) {
			let attr,
				markup = '<select class="repeater-control menu-select">';

			_.each( window._wpCustomizeNavMenusSettings.locationSlugMappedToName, ( name, location ) => {
				attr = `boldgrid_menu_${ location }` === type ? 'selected' : '';
				markup += `<option value="boldgrid_menu_${ location }"${ attr }>${ name }</option>`;
			} );

			markup += '</select>';

			return markup;
		},

		/**
		 * Container control event handler.
		 *
		 * @since 2.0.3
		 */
		updateValues() {
			let values = this.getValues();
			this.setting.set( values );
			this.updateTitles();
			this.updateAddTypes();
		},

		/**
		 * Retrieves user's currently set values for control.
		 *
		 * @since 2.0.3
		 */
		getValues() {
			let	sortableValue,
			values = [];
			_.each( this.container.find( '.connected-sortable' ), ( sortable, key ) => {
				sortableValue = $( sortable ).find( '.repeater' ).map( function() {
					return Object.assign( {}, this.dataset );
				} ).toArray();
				values[ key ] = {
					container: this.getContainer( sortable ),
					items: sortableValue
				};
			} );

			return values;
		},

		/**
		 * Gets the selected value for the container control.
		 *
		 * @since 2.0.3
		 */
		getContainer( sortable ) {
			return sortable.previousElementSibling.querySelector( '.selected' ).dataset.container;
		},

		/**
		 * Select event handler for controls.
		 *
		 * @since 2.0.3
		 */
		_select( e ) {
			let selector = $( e.currentTarget );
			selector.siblings().removeClass( 'selected' );
			selector.addClass( 'selected' );
		},

		/**
		 * Add Item event handler.
		 *
		 * @since 2.0.3
		 */
		_addItem( e ) {
			let dataset = e.currentTarget.dataset;
			e.currentTarget.parentElement.previousElementSibling.innerHTML += this.getMarkup( dataset );
			this.addRepeaterControls( true );
			this.refreshItems();
			this.updateValues();
		},

		/**
		 * Updates section titles with titles of repeaters contained inside.
		 *
		 * @since 2.0.3
		 */
		updateTitles() {
			_.each( this.sortable.sortable( 'instance' ).items, ( sortable ) => {
				let el = sortable.item[0],
					titleContainer = el.querySelector( '.title' ),
					title = [];

				el.querySelectorAll( '.repeater-title' ).forEach( titles => title.push( titles.textContent ) );
				title = title.join ( '<span class="title-divider">&#9679;</span>' );
				if ( _.isEmpty( title ) ) {
					titleContainer.classList.add( 'title-empty' );
					title = '<em>Empty Section</em>';
				}
				titleContainer.classList.remove( 'title-empty' );
				titleContainer.innerHTML = title;
			} );
		},

		/**
		 * Refresh container active ui elements.
		 *
		 * @since 2.0.3
		 *
		 * @param {Array} types Type of ui elements to refresh.
		 */
		refreshItems( types = [ 'sortable', 'accordion' ] ) {
			_.each( types, type => {
				this.sortable[ type ]( 'refresh' );
				this.container.find( '.connected-sortable' )[ type ]( 'refresh' );
			} )
		},

		/**
		 * Refresh sortables.
		 *
		 * @since 2.0.3
		 */
		refreshSortables() {
			this.sortable.sortable( 'refresh' );
			this.container.find( '.connected-sortable' ).sortable( 'refresh' );
		},

		/**
		 * Refresh accordions.
		 *
		 * @since 2.0.3
		 */
		refreshAccordions() {
			this.sortable.accordion( 'refresh' );
			this.container.find( '.connected-sortable' ).accordion( 'refresh' );
		},

		/**
		 * Get repeater markup.
		 *
		 * @since 2.0.3
		 */
		getMarkup( dataset ) {
			let attributes = Object.entries( dataset ).map( data => `data-${ data[0] }="${ data[1] }"` ).join( ' ' );
			return `<li class="repeater" ${ attributes }>
				<div class="repeater-input">
					<div class="repeater-handle">
						<div class="sortable-title">
							<span class="repeater-title"><i class="${ this.params.items[ dataset.key ].icon }"></i>${ this.params.items[ dataset.key ].title }</span><span class="dashicons dashicons-trash"></span>
						</div>
					</div>
					<div class="repeater-accordion-content-wrapper">
						<div class="repeater-accordion-content"></div>
					</div>
				</div>
			</li>`;
		},

		/**
		 * Update add item buttons.
		 *
		 * @since 2.0.3
		 */
		updateAddTypes() {
			this.sortable[0].querySelectorAll( '.bgtfw-sortable' ).forEach( button => {
				let type = this.getItem( button.dataset.key );
				if ( type ) {
					button.classList.remove( 'disabled' );
					button.dataset.type = this.getItem( button.dataset.key );
				} else {
					button.classList.add( 'disabled' );
				}
			} );
		},

		/**
		 * Handles adding the Add Item buttons to sortables.
		 *
		 * @since 2.0.3
		 */
		addTypes() {
			this.container[0].querySelectorAll( '.sortable-actions' ).forEach( sortableAction => {
				_.each( this.params.items, ( item, key ) => {
					sortableAction.innerHTML += this.getAddTypeMarkup( item, key );
				} );
			} );
		},

		/**
		 * Gets markup for add item buttons.
		 *
		 * @since 2.0.3
		 */
		getAddTypeMarkup( item, key ) {
			return `<span class="bgtfw-sortable ${ key }" data-key="${ key }" aria-label="Add ${ item.title }"><i class="fa fa-plus"></i>${ item.title }</span>`;
		},

		/**
		 * Gets all current items added to location.
		 *
		 * @since 2.0.3
		 */
		getCurrentItems() {
			return _.map( _.flatten( _.map( this.setting.get(), data => _.values( data.items ) ) ), values => values.type );
		},

		/**
		 * Gets all registered sidebar locations.
		 *
		 * @since 2.0.3
		 */
		getAllSidebarLocations() {
			return _.pluck( window._wpCustomizeWidgetsSettings.registeredSidebars, 'id' );
		},

		/**
		 * Gets all sidebar action names.
		 *
		 * @since 2.0.3
		 */
		getAllSidebarActions() {
			return this.getAllSidebarLocations().map( item => `bgtfw_sidebar_${ item }` );
		},

		/**
		 * Gets all sidebar action names filtered by location.
		 *
		 * @since 2.0.3
		 */
		getFilteredSidebarActions() {
			return _.filter( this.getAllSidebarActions(), sidebar => sidebar.includes( this.params.location ) );
		},

		/**
		 * Gets all currently used sidebar actions.
		 *
		 * @since 2.0.3
		 */
		getUsedSidebarActions() {
			return _.filter( this.getCurrentItems(), actions => actions.includes( 'bgtfw_sidebar' ) );
		},

		/**
		 * Gets all unused sidebar actions filtered by location.
		 *
		 * @since 2.0.3
		 */
		getAvailableSidebars() {
			return _.difference( this.getFilteredSidebarActions(), this.getUsedSidebarActions() );
		},

		/**
		 * Gets the next available sidebar item that can be added.
		 *
		 * @since 2.0.3
		 */
		getNextAvailableSidebar() {
			return _.first( this.getAvailableSidebars() );
		},

		/**
		 * Gets all menu action names that can be added.
		 *
		 * @since 2.0.3
		 */
		getAllMenuActions() {
			return Object.keys( window._wpCustomizeNavMenusSettings.locationSlugMappedToName ).map( item => `boldgrid_menu_${item}` );
		},

		/**
		 * Gets all used menu actions.
		 *
		 * @since 2.0.3
		 */
		getUsedMenuActions() {
			return _.filter( this.getCurrentItems(), actions => actions.includes( 'boldgrid_menu' ) );
		},

		/**
		 * Gets all unused menu actions.
		 *
		 * @since 2.0.3
		 */
		getAvailableMenus() {
			return _.difference( this.getAllMenuActions(), this.getConnectedMenus() );
		},

		/**
		 * Gets the next available menu item that can be added.
		 *
		 * @since 2.0.3
		 */
		getNextAvailableMenu() {
			return _.first( this.getAvailableMenus() );
		},

		/**
		 * Get item to be added to sortable based on type.
		 *
		 * @since 2.0.3
		 */
		getItem( type ) {
			switch ( type ) {
				case 'menu':
					type = this.getNextAvailableMenu();
					break;
				case 'sidebar':
					type = this.getNextAvailableSidebar();
					break;
				case 'branding':
					type = 'boldgrid_site_identity';
					break;
				default:
					break;
			}

			return type;
		},

		/**
		 * Get registered attribution link settings.
		 *
		 * @since 2.0.3
		 */
		getAttributionSettings() {
			return _.filter( _.mapObject( _wpCustomizeSettings.settings, ( setting, key ) => _.extend( setting, { id: key } ) ), setting => setting.id.includes( 'hide_' ) && setting.id.includes( '_attribution' ) );

		},

		/**
		 * Get connected control instances.
		 *
		 * @since 2.0.3
		 */
		getConnectedControls() {
			return _.filter( window._wpCustomizeSettings.controls, { type: this.params.type } );
		},

		/**
		 * Gets all connected items based on control type.
		 *
		 * @since 2.0.3
		 */
		getConnectedItems() {
			return _.flatten( [].concat( _.map( this.getConnectedControls(), control => this.id === control.id ? this.getCurrentItems() : _.isUndefined( api.control( control.id ) ) ? [] : api.control( control.id ).getCurrentItems() ) ) );
		},

		/**
		 * Gets all connected menus used in controls.
		 *
		 * @since 2.0.3
		 */
		getConnectedMenus() {
			return _.filter( this.getConnectedItems(), item => item.includes( 'boldgrid_menu' ) );
		},

		/**
		 * Retrieves the last found connected control or this control if none used.
		 *
		 * @since 2.0.3
		 */
		getLastConnected() {
			let last = _.last( this.getConnectedControls() ),
				id = last.id;
			return _.isUndefined( api.control( id ) ) ? this : api.control( id );
		}
	} );

	// Extend Section.
	_sectionEmbed = wp.customize.Section.prototype.embed;
	_sectionIsContextuallyActive = wp.customize.Section.prototype.isContextuallyActive;
	_sectionAttachEvents = wp.customize.Section.prototype.attachEvents;

	wp.customize.Section = wp.customize.Section.extend( {
		attachEvents: function() {
			var section;

			if ( 'bgtfw_section' !== this.params.type || 'undefined' === typeof this.params.section ) {
				_sectionAttachEvents.call( this );
				return;
			}

			_sectionAttachEvents.call( this );

			section = this;

			section.expanded.bind( function( expanded ) {
				var parent = api.section( section.params.section );

				expanded ? parent.contentContainer.addClass( 'current-section-parent' ) : parent.contentContainer.removeClass( 'current-section-parent' );
			} );

			section.container.find( '.customize-section-back' )
				.off( 'click keydown' )
				.on( 'click keydown', function( event ) {
					if ( api.utils.isKeydownButNotEnterEvent( event ) ) {
						return;
					}

					event.preventDefault(); // Keep this AFTER the key filter above

					if ( section.expanded() ) {
						api.section( section.params.section ).expand();
					}
				} );
		},

		embed: function() {
			var section, parentContainer;

			if ( 'bgtfw_section' !== this.params.type || 'undefined' === typeof this.params.section ) {
				_sectionEmbed.call( this );

				return;
			}

			_sectionEmbed.call( this );

			section = this;
			parentContainer = $( '#sub-accordion-section-' + this.params.section );

			parentContainer.append( section.headContainer );
		},

		isContextuallyActive: function() {
			var section, children, activeCount;

			if ( 'bgtfw_section' !== this.params.type ) {
				return _sectionIsContextuallyActive.call( this );
			}

			section = this;
			children = this._children( 'section', 'control' );

			api.section.each( function( child ) {
				if ( ! child.params.section || child.params.section !== section.id ) {
					return;
				}

				children.push( child );
			} );

			children.sort( api.utils.prioritySort );

			activeCount = 0;

			_( children ).each( function( child ) {
				if ( ( 'undefined' !== typeof child.isContextuallyActive ) && ( child.active() && child.isContextuallyActive() ) ) {
					activeCount += 1;
				} else if ( child.active() ) {
					activeCount += 1;
				}
			} );

			return ( 0 !== activeCount );
		}
	} );

} )( jQuery );
