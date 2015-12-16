(function(PouchDB, Neuro, global, undefined)
{

  Neuro.Debugs.POUCH_INIT = 2000;
  Neuro.Debugs.POUCH_ALL = 2001;
  Neuro.Debugs.POUCH_ALL_ERROR = 2002;
  Neuro.Debugs.POUCH_GET = 2003;
  Neuro.Debugs.POUCH_GET_ERROR = 2004;
  Neuro.Debugs.POUCH_CREATE = 2005;
  Neuro.Debugs.POUCH_CREATE_ERROR = 2006;
  Neuro.Debugs.POUCH_UPDATE = 2007;
  Neuro.Debugs.POUCH_UPDATE_ERROR = 2008;
  Neuro.Debugs.POUCH_REMOVE = 2009;
  Neuro.Debugs.POUCH_REMOVE_ERROR = 2010;
  Neuro.Debugs.POUCH_LIVE_REMOVE = 2011;
  Neuro.Debugs.POUCH_LIVE_SAVE = 2012;
  Neuro.Debugs.POUCH_LIVE_SAVE_IGNORE = 2013;

  if ( Neuro.debugMap )
  {
    Neuro.debugMap[ Neuro.Debugs.POUCH_INIT ] = 'PouchDB Initialized';
    Neuro.debugMap[ Neuro.Debugs.POUCH_ALL ] = 'PouchDB All';
    Neuro.debugMap[ Neuro.Debugs.POUCH_ALL_ERROR ] = 'PouchDB All Error';
    Neuro.debugMap[ Neuro.Debugs.POUCH_GET ] = 'PouchDB Get';
    Neuro.debugMap[ Neuro.Debugs.POUCH_GET_ERROR ] = 'PouchDB Get Error';
    Neuro.debugMap[ Neuro.Debugs.POUCH_CREATE ] = 'PouchDB Create';
    Neuro.debugMap[ Neuro.Debugs.POUCH_CREATE_ERROR ] = 'PouchDB Create Error';
    Neuro.debugMap[ Neuro.Debugs.POUCH_UPDATE ] = 'PouchDB Update';
    Neuro.debugMap[ Neuro.Debugs.POUCH_UPDATE_ERROR ] = 'PouchDB Update Error';
    Neuro.debugMap[ Neuro.Debugs.POUCH_REMOVE ] = 'PouchDB Remove';
    Neuro.debugMap[ Neuro.Debugs.POUCH_REMOVE_ERROR ] = 'PouchDB Remove Error';
    Neuro.debugMap[ Neuro.Debugs.POUCH_LIVE_REMOVE ] = 'PouchDB Live Remove';
    Neuro.debugMap[ Neuro.Debugs.POUCH_LIVE_SAVE ] = 'PouchDB Live Save';
    Neuro.debugMap[ Neuro.Debugs.POUCH_LIVE_SAVE_IGNORE ] = 'PouchDB Live Save Ignored';
  }

  var cache = {};

  var Neuro_live = Neuro.live;
  var Neuro_rest = Neuro.rest;
  var Neuro_store = Neuro.store;

  Neuro.pouch = function(name, options)
  {
    return name in cache ? cache[ name ] : cache[ name ] = new PouchDB( name, options );
  };

  if ( !Neuro.restSet )
  {
    Neuro.rest = function(database)
    {
      if ( !database.api )
      {
        return Neuro_rest.call( this, database );
      }

      database.fullSave = true;
      database.cache = Neuro.Cache.None;
      database.origin = Neuro.uuid();

      var pouch = this.pouch( database.name, database.storeOptions );

      var options = {
        include_docs: true
      };

      PouchDB.replicate( database.name, database.api, {
        live: true,
        retry: true
      });

      Neuro.debug( Neuro.Debugs.POUCH_INIT, database, pouch );

      return {

        pouchdb: pouch,

        all: function( success, failure )
        {
          function onAll(response)
          {
            Neuro.debug( Neuro.Debugs.POUCH_ALL, database, response );

            var values = [];
            for (var i = 0; i < response.rows.length; i++) 
            {
              values.push( response.rows[ i ].doc );
            }

            success( values );
          }

          function onAllError(err)
          {
            Neuro.debug( Neuro.Debugs.POUCH_ALL_ERROR, database, err );
            
            failure( [], err.status );
          }

          pouch.allDocs( options ).then( onAll ).catch( onAllError );
        },

        get: function( model, success, failure )
        {
          var key = String( model.$key() );

          function onGet(response)
          {
            Neuro.debug( Neuro.Debugs.POUCH_GET, database, model, key, response );

            model._rev = response._rev;
            success( response );
          }

          function onGetError(err)
          {
            Neuro.debug( Neuro.Debugs.POUCH_GET_ERROR, database, model, key, err );

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
            Neuro.debug( Neuro.Debugs.POUCH_CREATE, database, model, encoded, response );

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
            Neuro.debug( Neuro.Debugs.POUCH_CREATE_ERROR, database, model, encoded, err );

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
            Neuro.debug( Neuro.Debugs.POUCH_UPDATE, database, model, encoded, response );

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
            Neuro.debug( Neuro.Debugs.POUCH_UPDATE_ERROR, database, model, encoded, err );

            failure( null, err.status );
          }

          pouch.put( encoded ).then( onUpdate ).catch( onUpdateError );
        },

        remove: function( model, success, failure )
        {
          var key = String( model.$key() );

          function onRemove(response)
          {
            Neuro.debug( Neuro.Debugs.POUCH_REMOVE, database, model, key, response );

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
            Neuro.debug( Neuro.Debugs.POUCH_REMOVE_ERROR, database, model, key, err );

            failure( {}, err.status );
          }

          pouch.remove( key ).then( onRemove ).catch( onRemoveError );
        },

        query: function( query, success, failure )
        {
          success( [] );
        }

      };
    };

    Neuro.restSet = true;
  }

  if ( !Neuro.liveSet )
  {
    Neuro.live = function(database)
    {
      if ( !database.api )
      {
        return Neuro_live.call( this, database );
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
          Neuro.debug( Neuro.Debugs.POUCH_LIVE_REMOVE, database, change );

          database.liveRemove( change.id );
        } 
        else 
        {
          if ( change.doc.$origin !== database.origin ) 
          {
            Neuro.debug( Neuro.Debugs.POUCH_LIVE_SAVE, database, change );

            database.liveSave( change.id, change.doc );
          } 
          else 
          {
            Neuro.debug( Neuro.Debugs.POUCH_LIVE_SAVE_IGNORE, database, change );
          }
        }
      }

      pouch.changes( options ).on( 'change', onLiveChange );

      return {
        pouchdb: pouch,
        save: Neuro.noop,
        remove: Neuro.noop
      };
    };

    Neuro.liveSet = true;
  }

})( PouchDB, Neuro, this );