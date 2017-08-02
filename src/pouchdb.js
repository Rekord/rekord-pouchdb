// UMD (Universal Module Definition)
(function (root, factory)
{
  if (typeof define === 'function' && define.amd) // jshint ignore:line
  {
    // AMD. Register as an anonymous module.
    define(['rekord', 'pouchdb'], function(Rekord, PouchDB) { // jshint ignore:line
      return factory(root, Rekord, PouchDB);
    });
  }
  else if (typeof module === 'object' && module.exports)  // jshint ignore:line
  {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(global, require('rekord'), require('pouchdb'));  // jshint ignore:line
  }
  else
  {
    // Browser globals (root is window)
    root.Rekord = factory(root, root.Rekord, root.PouchDB);
  }
}(this, function(global, Rekord, PouchDB, undefined)
{

  var Debugs = Rekord.Debugs;

  var cache = {};

  var Rekord_live = Rekord.live;
  var Rekord_rest = Rekord.rest;
  var Rekord_store = Rekord.store;

  var transfer = Rekord.transfer;
  var copy = Rekord.copy;
  var isObject = Rekord.isObject;

  Debugs.POUCH_INIT = 2000;
  Debugs.POUCH_ALL = 2001;
  Debugs.POUCH_ALL_ERROR = 2002;
  Debugs.POUCH_GET = 2003;
  Debugs.POUCH_GET_ERROR = 2004;
  Debugs.POUCH_CREATE = 2005;
  Debugs.POUCH_CREATE_ERROR = 2006;
  Debugs.POUCH_UPDATE = 2007;
  Debugs.POUCH_UPDATE_ERROR = 2008;
  Debugs.POUCH_REMOVE = 2009;
  Debugs.POUCH_REMOVE_ERROR = 2010;
  Debugs.POUCH_LIVE_REMOVE = 2011;
  Debugs.POUCH_LIVE_SAVE = 2012;
  Debugs.POUCH_LIVE_SAVE_IGNORE = 2013;

  if ( Rekord.debugMap )
  {
    Rekord.debugMap[ Debugs.POUCH_INIT ] = 'PouchDB Initialized';
    Rekord.debugMap[ Debugs.POUCH_ALL ] = 'PouchDB All';
    Rekord.debugMap[ Debugs.POUCH_ALL_ERROR ] = 'PouchDB All Error';
    Rekord.debugMap[ Debugs.POUCH_GET ] = 'PouchDB Get';
    Rekord.debugMap[ Debugs.POUCH_GET_ERROR ] = 'PouchDB Get Error';
    Rekord.debugMap[ Debugs.POUCH_CREATE ] = 'PouchDB Create';
    Rekord.debugMap[ Debugs.POUCH_CREATE_ERROR ] = 'PouchDB Create Error';
    Rekord.debugMap[ Debugs.POUCH_UPDATE ] = 'PouchDB Update';
    Rekord.debugMap[ Debugs.POUCH_UPDATE_ERROR ] = 'PouchDB Update Error';
    Rekord.debugMap[ Debugs.POUCH_REMOVE ] = 'PouchDB Remove';
    Rekord.debugMap[ Debugs.POUCH_REMOVE_ERROR ] = 'PouchDB Remove Error';
    Rekord.debugMap[ Debugs.POUCH_LIVE_REMOVE ] = 'PouchDB Live Remove';
    Rekord.debugMap[ Debugs.POUCH_LIVE_SAVE ] = 'PouchDB Live Save';
    Rekord.debugMap[ Debugs.POUCH_LIVE_SAVE_IGNORE ] = 'PouchDB Live Save Ignored';
  }

  function pouch(name, options)
  {
    return name in cache ? cache[ name ] : cache[ name ] = new PouchDB( name, options );
  }

  function RestFactory(database)
  {
    if ( !database.api )
    {
      return Rekord_rest.call( this, database );
    }

    database.fullSave = true;
    database.cache = Rekord.Cache.None;
    database.origin = Rekord.uuid();

    var pouch = this.pouch( database.name, database.storeOptions );

    var options = {
      include_docs: true
    };

    PouchDB.replicate( database.name, database.api, {
      live: true,
      retry: true
    });

    Rekord.debug( Debugs.POUCH_INIT, database, pouch );

    return {

      pouchdb: pouch,

      all: function( extraOptions, success, failure )
      {
        function onAll(response)
        {
          Rekord.debug( Debugs.POUCH_ALL, database, response );

          var values = [];
          for (var i = 0; i < response.rows.length; i++)
          {
            values.push( response.rows[ i ].doc );
          }

          success( values );
        }

        function onAllError(err)
        {
          Rekord.debug( Debugs.POUCH_ALL_ERROR, database, err );

          failure( [], err.status );
        }

        var allOptions = options;

        if ( isObject( extraOptions ) )
        {
          allOptions = transfer( extraOptions, copy( allOptions ) );
        }

        pouch.allDocs( allOptions ).then( onAll ).catch( onAllError );
      },

      get: function( model, extraOptions, success, failure )
      {
        var key = String( model.$key() );

        function onGet(response)
        {
          Rekord.debug( Debugs.POUCH_GET, database, model, key, response );

          model._rev = response._rev;
          success( response );
        }

        function onGetError(err)
        {
          Rekord.debug( Debugs.POUCH_GET_ERROR, database, model, key, err );

          failure( null, err.status );
        }

        pouch.get( key ).then( onGet ).catch( onGetError );
      },

      create: function( model, encoded, extraOptions, success, failure )
      {
        encoded._id = String( model.$key() );
        encoded.$origin = database.origin;

        function onCreate(response)
        {
          Rekord.debug( Debugs.POUCH_CREATE, database, model, encoded, response );

          if ( response.ok )
          {
            model._rev = response.rev;
            encoded._rev = response.rev;
            success( {} );
          }
          else
          {
            failure( null, response.status );
          }
        }

        function onCreateError(err)
        {
          Rekord.debug( Debugs.POUCH_CREATE_ERROR, database, model, encoded, err );

          failure( null, err.status );
        }

        pouch.put( encoded ).then( onCreate ).catch( onCreateError );
      },

      update: function( model, encoded, extraOptions, success, failure )
      {
        encoded._id = String( model.$key() );
        encoded._rev = model._rev;
        encoded.$origin = database.origin;

        function onUpdate(response)
        {
          Rekord.debug( Debugs.POUCH_UPDATE, database, model, encoded, response );

          if ( response.ok )
          {
            model._rev = response.rev;
            encoded._rev = response.rev;
            success( {} );
          }
          else
          {
            failure( null, response.status );
          }
        }

        function onUpdateError(err)
        {
          Rekord.debug( Debugs.POUCH_UPDATE_ERROR, database, model, encoded, err );

          failure( null, err.status );
        }

        pouch.put( encoded ).then( onUpdate ).catch( onUpdateError );
      },

      remove: function( model, extraOptions, success, failure )
      {
        var key = String( model.$key() );

        function onRemove(response)
        {
          Rekord.debug( Debugs.POUCH_REMOVE, database, model, key, response );

          if ( response.ok )
          {
            success( {} );
          }
          else
          {
            failure( {}, response.status );
          }
        }

        function onRemoveError(err)
        {
          Rekord.debug( Debugs.POUCH_REMOVE_ERROR, database, model, key, err );

          failure( {}, err.status );
        }

        pouch.remove( key ).then( onRemove ).catch( onRemoveError );
      },

      query: function( url, query, extraOptions, success, failure )
      {
        success( [] );
      }

    };
  }

  function LiveFactory(database)
  {
    if ( !database.api )
    {
      return Rekord_live.call( this, database );
    }

    var pouch = this.pouch( database.name );
    var options =
    {
      since: 'now',
      live: true,
      include_docs: true
    };

    function onLiveChange(change)
    {
      if ( change.deleted )
      {
        Rekord.debug( Debugs.POUCH_LIVE_REMOVE, database, change );

        database.liveRemove( change.id );
      }
      else
      {
        if ( change.doc.$origin !== database.origin )
        {
          Rekord.debug( Debugs.POUCH_LIVE_SAVE, database, change );

          database.liveSave( change.id, change.doc );
        }
        else
        {
          Rekord.debug( Debugs.POUCH_LIVE_SAVE_IGNORE, database, change );
        }
      }
    }

    pouch.changes( options ).on( 'change', onLiveChange );

    return {
      pouchdb: pouch,
      save: Rekord.noop,
      remove: Rekord.noop
    };
  }

  Rekord.pouch = pouch;

  Rekord.Rests.Pouch = RestFactory;
  Rekord.setRest( RestFactory );

  Rekord.Lives.Pouch = LiveFactory;
  Rekord.setLive( LiveFactory );

  return Rekord;

}));
