/**
 * Module dependencies.
 */
var util = require("util"),
  OAuth2Strategy = require("passport-oauth").OAuth2Strategy,
  InternalOAuthError = require("passport-oauth").InternalOAuthError;

const fetch = require("node-fetch");

/**
 * `Strategy` constructor.
 *
 * The Google authentication strategy authenticates requests by delegating to
 * Google using the OAuth 2.0 protocol.
 *
 * Applications must supply a `verify` callback which accepts an `idToken`,
 * `refreshToken` and service-specific `profile`, and then calls the `done`
 * callback supplying a `user`, which should be set to `false` if the
 * credentials are not valid.  If an exception occured, `err` should be set.
 *
 * Options:
 *   - `clientID`      your Google application's client id
 *   - `clientSecret`  your Google application's client secret
 *   - `callbackURL`   URL to which Google will redirect the user after granting authorization
 *
 * Examples:
 *
 *     passport.use(new GoogleStrategy({
 *         clientID: '123-456-789',
 *         clientSecret: 'shhh-its-a-secret'
 *         callbackURL: 'https://www.example.net/auth/google/callback'
 *       },
 *       function(idToken, refreshToken, profile, done) {
 *         User.findOrCreate(..., function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
class GoogleTokenStrategy {
  constructor(options, verify) {
    options = options || {};
    options.authorizationURL =
      options.authorizationURL || "https://accounts.google.com/o/oauth2/auth";
    options.tokenURL =
      options.tokenURL || "https://accounts.google.com/o/oauth2/token";

    OAuth2Strategy.call(this, options, verify);
    this.name = "google-token";
  }
  /**
   * Authenticate request by delegating to a service provider using OAuth 2.0.
   *
   * @param {Object} req
   * @api protected
   */
  authenticate(req, options) {
    options = options || {};
    var self = this;

    if (req.query && req.query.error) {
      // TODO: Error information pertaining to OAuth 2.0 flows is encoded in the
      //       query parameters, and should be propagated to the application.
      return this.error(req.query.error);
    }

    if (!req.body) {
      return this.error("Body is not defined");
    }

    var idToken =
      req.body.access_token ||
      req.query.access_token ||
      req.headers.access_token;
    var refreshToken =
      req.body.refresh_token ||
      req.query.refresh_token ||
      req.headers.refresh_token;

    self._loadUserProfile(idToken, function (err, profile) {
      if (err) {
        return self.fail(err);
      }

      function verified(err, user, info) {
        if (err) {
          return self.error(err);
        }
        if (!user) {
          return self.fail(info);
        }
        self.success(user, info);
      }

      if (self._passReqToCallback) {
        self._verify(req, idToken, refreshToken, profile, verified);
      } else {
        self._verify(idToken, refreshToken, profile, verified);
      }
    });
  }
  /**
   * Retrieve user profile from Google.
   *
   * This function constructs a normalized profile, with the following properties:
   *
   *   - `provider`         always set to `google`
   *   - `id`
   *   - `username`
   *   - `displayName`
   *
   * @param {String} idToken
   * @param {Function} done
   * @api protected
   */
  userProfile(idToken, done) {
    fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`)
      .then(async (response) => {
        try {
          const body = await response.text();
          var json = JSON.parse(body);

          var profile = { provider: "google" };
          profile.id = json.id;
          profile.displayName = json.name;
          profile.name = {
            familyName: json.family_name,
            givenName: json.given_name,
          };
          profile.emails = [{ value: json.email }];
          profile.photos = [{ value: json.picture }];

          profile._raw = body;
          profile._json = json;

          done(null, profile);
        } catch (e) {
          done(e);
        }
      })
      .catch((err) =>
        done(new InternalOAuthError("failed to fetch user profile", err))
      );
  }
  /**
   * Load user profile, contingent upon options.
   *
   * @param {String} idToken
   * @param {Function} done
   * @api private
   */
  _loadUserProfile(idToken, done) {
    var self = this;

    function loadIt() {
      return self.userProfile(idToken, done);
    }
    function skipIt() {
      return done(null);
    }

    if (
      typeof this._skipUserProfile == "function" &&
      this._skipUserProfile.length > 1
    ) {
      // async
      this._skipUserProfile(idToken, function (err, skip) {
        if (err) {
          return done(err);
        }
        if (!skip) {
          return loadIt();
        }
        return skipIt();
      });
    } else {
      var skip =
        typeof this._skipUserProfile == "function"
          ? this._skipUserProfile()
          : this._skipUserProfile;
      if (!skip) {
        return loadIt();
      }
      return skipIt();
    }
  }
}

/**
 * Inherit from `OAuth2Strategy`.
 */
util.inherits(GoogleTokenStrategy, OAuth2Strategy);

/**
 * Expose `GoogleTokenStrategy`.
 */
module.exports = GoogleTokenStrategy;
