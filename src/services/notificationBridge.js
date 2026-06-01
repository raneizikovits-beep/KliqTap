const _listeners = {};

export const notificationBridge = {
    on(event, cb) {
        if (!_listeners[event]) _listeners[event] = [];
        if (!_listeners[event].includes(cb)) {
            _listeners[event].push(cb);
        }
    },
    off(event, cb) {
        if (!_listeners[event]) return;
        _listeners[event] = _listeners[event].filter(fn => fn !== cb);
    },
    emit(event, payload) {
        (_listeners[event] || []).forEach(fn => {
            try {
                const result = fn(payload);
                if (result instanceof Promise) {
                    result.catch(err => console.warn(`[Bridge] ${event}:`, err));
                }
            } catch (err) {
                console.warn(`[Bridge] ${event}:`, err);
            }
        });
    },
};