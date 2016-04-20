(function(PouchDB, Rekord, global, undefined)
{

  Rekord.Debugs.POUCH_INIT = 2000;
  Rekord.Debugs.POUCH_ALL = 2001;
  Rekord.Debugs.POUCH_ALL_ERROR = 2002;
  Rekord.Debugs.POUCH_GET = 2003;
  Rekord.Debugs.POUCH_GET_ERROR = 2004;
  Rekord.Debugs.POUCH_CREATE = 2005;
  Rekord.Debugs.POUCH_CREATE_ERROR = 2006;
  Rekord.Debugs.POUCH_UPDATE = 2007;
  Rekord.Debugs.POUCH_UPDATE_ERROR = 2008;
  Rekord.Debugs.POUCH_REMOVE = 2009;
  Rekord.Debugs.POUCH_REMOVE_ERROR = 2010;
  Rekord.Debugs.POUCH_LIVE_REMOVE = 2011;
  Rekord.Debugs.POUCH_LIVE_SAVE = 2012;
  Rekord.Debugs.POUCH_LIVE_SAVE_IGNORE = 2013;

  if ( Rekord.debugMap )
  {
    Rekord.debugMap[ Rekord.Debugs.POUCH_INIT ] = 'PouchDB Initialized';
    Rekord.debugMap[ Rekord.Debugs.POUCH_ALL ] = 'PouchDB All';
    Rekord.debugMap[ Rekord.Debugs.POUCH_ALL_ERROR ] = 'PouchDB All Error';
    Rekord.debugMap[ Rekord.Debugs.POUCH_GET ] = 'PouchDB Get';
    Rekord.debugMap[ Rekord.Debugs.POUCH_GET_ERROR ] = 'PouchDB Get Error';
    Rekord.debugMap[ Rekord.Debugs.POUCH_CREATE ] = 'PouchDB Create';
    Rekord.debugMap[ Rekord.Debugs.POUCH_CREATE_ERROR ] = 'PouchDB Create Error';
    Rekord.debugMap[ Rekord.Debugs.POUCH_UPDATE ] = 'PouchDB Update';
    Rekord.debugMap[ Rekord.Debugs.POUCH_UPDATE_ERROR ] = 'PouchDB Update Error';
    Rekord.debugMap[ Rekord.Debugs.POUCH_REMOVE ] = 'PouchDB Remove';
    Rekord.debugMap[ Rekord.Debugs.POUCH_REMOVE_ERROR ] = 'PouchDB Remove Error';
    Rekord.debugMap[ Rekord.Debugs.POUCH_LIVE_REMOVE ] = 'PouchDB Live Remove';
    Rekord.debugMap[ Rekord.Debugs.POUCH_LIVE_SAVE ] = 'PouchDB Live Save';
    Rekord.debugMap[ Rekord.Debugs.POUCH_LIVE_SAVE_IGNORE ] = 'PouchDB Live Save Ignored';
  }

  var cache = {};

  var Rekord_live = Rekord.live;
  var Rekord_rest = Rekord.rest;
  var Rekord_store = Rekord.store;

  Rekord.pouch = function(name, options)
  {
    return name in cache ? cache[ name ] : cache[ name ] = new PouchDB( name, options );
  };

  Rekord.setRest(function(database)
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

    Rekord.debug( Rekord.Debugs.POUCH_INIT, database, pouch );

    return {

      pouchdb: pouch,

      all: function( success, failure )
      {
        function onAll(response)
        {
          Rekord.debug( Rekord.Debugs.POUCH_ALL, database, response );

          var values = [];
          for (var i = 0; i < response.rows.length; i++)
          {
            values.push( response.rows[ i ].doc );
          }

          success( values );
        }

        function onAllError(err)
        {
          Rekord.debug( Rekord.Debugs.POUCH_ALL_ERROR, database, err );

          failure( [], err.status );
        }

        pouch.allDocs( options ).then( onAll ).catch( onAllError );
      },

      get: function( model, success, failure )
      {
        var key = String( model.$key() );

        function onGet(response)
        {
          Rekord.debug( Rekord.Debugs.POUCH_GET, database, model, key, response );

          model._rev = response._rev;
          success( response );
        }

        function onGetError(err)
        {
          Rekord.debug( Rekord.Debugs.POUCH_GET_ERROR, database, model, key, err );

          failure( null, err.status );
        }

        pouch.get( key ).then( onGet ).catch( onGetError );
      },

      create: function( model, encoded, success, failure )
      {
        encoded._id = String( model.$key() );
        encoded.$origin = database.origin;

        function onCreate(response)
        {
          Rekord.debug( Rekord.Debugs.POUCH_CREATE, database, model, encoded, response );

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
          Rekord.debug( Rekord.Debugs.POUCH_CREATE_ERROR, database, model, encoded, err );

          failure( null, err.status );
        }

        pouch.put( encoded ).then( onCreate ).catch( onCreateError );
      },

      update: function( model, encoded, success, failure )
      {
        encoded._id = String( model.$key() );
        encoded._rev = model._rev;
        encoded.$origin = database.origin;

        function onUpdate(response)
        {
          Rekord.debug( Rekord.Debugs.POUCH_UPDATE, database, model, encoded, response );

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
          Rekord.debug( Rekord.Debugs.POUCH_UPDATE_ERROR, database, model, encoded, err );

          failure( null, err.status );
        }

        pouch.put( encoded ).then( onUpdate ).catch( onUpdateError );
      },

      remove: function( model, success, failure )
      {
        var key = String( model.$key() );

        function onRemove(response)
        {
          Rekord.debug( Rekord.Debugs.POUCH_REMOVE, database, model, key, response );

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
          Rekord.debug( Rekord.Debugs.POUCH_REMOVE_ERROR, database, model, key, err );

          failure( {}, err.status );
        }

        pouch.remove( key ).then( onRemove ).catch( onRemoveError );
      },

      query: function( url, query, success, failure )
      {
        success( [] );
      }

    };
  });


  Rekord.setLive(function(database)
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
        Rekord.debug( Rekord.Debugs.POUCH_LIVE_REMOVE, database, change );

        database.liveRemove( change.id );
      }
      else
      {
        if ( change.doc.$origin !== database.origin )
        {
          Rekord.debug( Rekord.Debugs.POUCH_LIVE_SAVE, database, change );

          database.liveSave( change.id, change.doc );
        }
        else
        {
          Rekord.debug( Rekord.Debugs.POUCH_LIVE_SAVE_IGNORE, database, change );
        }
      }
    }

    pouch.changes( options ).on( 'change', onLiveChange );

    return {
      pouchdb: pouch,
      save: Rekord.noop,
      remove: Rekord.noop
    };
  });

})( PouchDB, Rekord, this );
