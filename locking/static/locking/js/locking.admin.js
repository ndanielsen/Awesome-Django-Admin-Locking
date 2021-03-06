/**
 * Extends locking.js code for use with in Django's admin
 */
;(function (locking, undefined) {
    'use strict';

    var $ = locking.jQuery;

    /**
     * When instantiated ChangeListView periodically checks the locking API
     * and displays which articles are locked.
     */
    var ChangeListView = function (opts) {
        this.currentUser = opts.currentUser;
        this.api = new locking.API({
            appLabel: opts.appLabel,
            modelName: opts.modelName,
        });
        this.cookieName = opts.appLabel + opts.modelName + 'unlock';
        this.updateStatus();
        setInterval(this.updateStatus.bind(this), opts.ping * 1000);
    };
    ChangeListView.prototype.updateStatus = function () {
        var self = this;
        this.api.ajax({success: function (data) {
            var user, name, lockedClass, lockedMessage;
            $('.locking-status.locked').removeClass('locked').removeAttr('title');
            for (var i = 0; i < data.length; i++) {
                user = data[i]['locked_by'];
                if (user['username'] === self.currentUser) {
                    lockedMessage = "You are currently editing this";
                    lockedClass = "editing";
                } else {
                    name = user['first_name'] + ' ' + user['last_name'];
                    if (name === ' ') {
                        name = user['username'];
                    }
                    lockedMessage = 'Locked by ' + name + ' (' + user['email'] + ')';
                    lockedClass = "locked";
                }
                $('#locking-' + data[i]['object_id'])
                    .removeClass('locked editing')
                    .addClass(lockedClass)
                    .attr('title', lockedMessage)
                    .click(function () {
                        locking.cookies.set(self.cookieName, '1', 60 * 1000);
                    });
            }
        }});
    };
    locking.ChangeListView = ChangeListView;


    /**
     * Extends LockingForm with logic specific to Django admin forms
     */
    var LockingAdminForm = function($form, opts) {
        this.init($form, opts);

        var cookieName = opts.appLabel + opts.modelName + 'unlock';
        if (locking.cookies.get(cookieName) === '1') {
            this.hasHadLock = true;
            this.takeLock();
            locking.cookies.del(cookieName);
        }

        // Don't remove the lock when choosing 'save and continue editing'
        var self = this;
        $('input[type=submit][name="_continue"]').click(function() {
            self.removeLockOnUnload = false;
        });
    };
    $.extend(LockingAdminForm.prototype, locking.LockingForm.prototype);
    $.extend(LockingAdminForm.prototype, {
        warningHtml: '<ul class="messagelist grp-messagelist">' +
                        '<li class="error grp-error" id="locking-warning">' +
                            'Form is locked by <span class="locking-locked-by"></span>' +
                            '<a id="locking-take-lock" class="button grp-button rounded-button" onclick="window.locking.lockingFormInstance.takeLock()">Take over lock</a>' +
                        '</li>' +
                     '</ul>',
        lockedBy: {
            setUp: function (data) {
                this.name = data['username'];
                if (data['first_name'] && data['last_name']) {
                    this.name = data['first_name'] + ' ' + data['last_name'];
                }
                this.email = data.email;
            }
        },
        disableForm: function(data) {
            if (!this.formDisabled) {
                var self = this;

                // Disable Delete link
                $('.deletelink').css({'cursor': 'not-allowed', 'opacity': 0.5}).click(false);

                // Add warning notice to form
                this.$form.before(this.warningHtml);

                // Lookup who has the lock
                self.lockedBy.setUp(data[0]['locked_by']);
                $("#locking-warning .locking-locked-by").html(
                    self.lockedBy.name +
                    ' (<a href="mailto:' + self.lockedBy.email + '">' +
                        self.lockedBy.email +
                    '</a>)'
                );
            }
            locking.LockingForm.prototype.disableForm.call(this);
        },
        enableForm: function() {
            if (this.formDisabled) {
                $('#locking-warning').parent().remove();
            }
            locking.LockingForm.prototype.enableForm.call(this);
        }
    });
    locking.LockingAdminForm = LockingAdminForm;

})(window.locking);