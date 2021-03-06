
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.23.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/specifics/Onourowntime.svelte generated by Svelte v3.23.0 */

    const file = "src/specifics/Onourowntime.svelte";

    function create_fragment(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let br2;
    	let br3;
    	let br4;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let br11;
    	let br12;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let br18;
    	let br19;
    	let br20;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			t5 = space();
    			img5 = element("img");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			img7 = element("img");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			add_location(br0, file, 6, 1, 54);
    			add_location(br1, file, 6, 5, 58);
    			add_location(br2, file, 6, 9, 62);
    			add_location(br3, file, 6, 13, 66);
    			add_location(br4, file, 6, 17, 70);
    			attr_dev(img0, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/onourowntime/1.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file, 7, 1, 76);
    			attr_dev(img1, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/onourowntime/3.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file, 8, 1, 153);
    			attr_dev(img2, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/onourowntime/4.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file, 9, 1, 230);
    			attr_dev(img3, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/onourowntime/5.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file, 10, 1, 307);
    			attr_dev(img4, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/onourowntime/2.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file, 11, 1, 384);
    			add_location(br5, file, 11, 76, 459);
    			add_location(br6, file, 11, 80, 463);
    			add_location(br7, file, 11, 84, 467);
    			add_location(br8, file, 11, 88, 471);
    			add_location(br9, file, 11, 92, 475);
    			add_location(br10, file, 11, 96, 479);
    			add_location(br11, file, 11, 100, 483);
    			add_location(br12, file, 11, 104, 487);
    			attr_dev(img5, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/onourowntime/a.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file, 12, 1, 493);
    			attr_dev(img6, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/onourowntime/b.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file, 13, 1, 570);
    			attr_dev(img7, "class", "img portfolio-item svelte-1phlr82");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/onourowntime/c.jpg")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file, 14, 1, 647);
    			add_location(br13, file, 14, 76, 722);
    			add_location(br14, file, 14, 80, 726);
    			add_location(br15, file, 14, 84, 730);
    			add_location(br16, file, 14, 88, 734);
    			add_location(br17, file, 14, 92, 738);
    			add_location(br18, file, 14, 96, 742);
    			add_location(br19, file, 14, 100, 746);
    			add_location(br20, file, 14, 104, 750);
    			attr_dev(div, "class", "backgroundcolor svelte-1phlr82");
    			add_location(div, file, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, br2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, br18);
    			append_dev(div, br19);
    			append_dev(div, br20);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Onourowntime> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Onourowntime", $$slots, []);
    	return [];
    }

    class Onourowntime extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Onourowntime",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/specifics/Green.svelte generated by Svelte v3.23.0 */

    const file$1 = "src/specifics/Green.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br2;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let br3;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let br4;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let br5;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let br6;
    	let t6;
    	let video;
    	let source;
    	let source_src_value;
    	let t7;
    	let br7;
    	let t8;
    	let img6;
    	let img6_src_value;
    	let br8;
    	let t9;
    	let img7;
    	let img7_src_value;
    	let br9;
    	let t10;
    	let img8;
    	let img8_src_value;
    	let br10;
    	let t11;
    	let img9;
    	let img9_src_value;
    	let br11;
    	let t12;
    	let img10;
    	let img10_src_value;
    	let br12;
    	let t13;
    	let img11;
    	let img11_src_value;
    	let t14;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let br18;
    	let br19;
    	let br20;
    	let t15;
    	let img12;
    	let img12_src_value;
    	let t16;
    	let img13;
    	let img13_src_value;
    	let br21;
    	let t17;
    	let img14;
    	let img14_src_value;
    	let t18;
    	let img15;
    	let img15_src_value;
    	let t19;
    	let br22;
    	let br23;
    	let br24;
    	let br25;
    	let br26;
    	let br27;
    	let br28;
    	let br29;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			br2 = element("br");
    			t2 = space();
    			img2 = element("img");
    			br3 = element("br");
    			t3 = space();
    			img3 = element("img");
    			br4 = element("br");
    			t4 = space();
    			img4 = element("img");
    			br5 = element("br");
    			t5 = space();
    			img5 = element("img");
    			br6 = element("br");
    			t6 = space();
    			video = element("video");
    			source = element("source");
    			t7 = text("\n  \t\tYour browser does not support HTML video.\n\t");
    			br7 = element("br");
    			t8 = space();
    			img6 = element("img");
    			br8 = element("br");
    			t9 = space();
    			img7 = element("img");
    			br9 = element("br");
    			t10 = space();
    			img8 = element("img");
    			br10 = element("br");
    			t11 = space();
    			img9 = element("img");
    			br11 = element("br");
    			t12 = space();
    			img10 = element("img");
    			br12 = element("br");
    			t13 = space();
    			img11 = element("img");
    			t14 = space();
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			t15 = space();
    			img12 = element("img");
    			t16 = space();
    			img13 = element("img");
    			br21 = element("br");
    			t17 = space();
    			img14 = element("img");
    			t18 = space();
    			img15 = element("img");
    			t19 = space();
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			br29 = element("br");
    			add_location(br0, file$1, 6, 1, 54);
    			add_location(br1, file$1, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/thesis/1smaller.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$1, 7, 1, 64);
    			attr_dev(img1, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/thesis/2smaller.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$1, 8, 1, 142);
    			add_location(br2, file$1, 8, 77, 218);
    			attr_dev(img2, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/thesis/cover.gif")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$1, 9, 1, 224);
    			add_location(br3, file$1, 9, 74, 297);
    			attr_dev(img3, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/thesis/3smaller.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$1, 11, 1, 304);
    			add_location(br4, file$1, 11, 77, 380);
    			attr_dev(img4, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/thesis/4smaller.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$1, 12, 1, 386);
    			add_location(br5, file$1, 12, 77, 462);
    			attr_dev(img5, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/thesis/6smaller.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$1, 14, 1, 470);
    			add_location(br6, file$1, 14, 77, 546);
    			if (source.src !== (source_src_value = "igms/thesis/green6.mp4")) attr_dev(source, "src", source_src_value);
    			attr_dev(source, "type", "video/mp4");
    			add_location(source, file$1, 16, 3, 625);
    			attr_dev(video, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(video, "width", "400");
    			video.controls = true;
    			video.autoplay = true;
    			video.loop = true;
    			add_location(video, file$1, 15, 1, 552);
    			add_location(br7, file$1, 18, 9, 735);
    			attr_dev(img6, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/thesis/7smaller.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$1, 19, 1, 741);
    			add_location(br8, file$1, 19, 77, 817);
    			attr_dev(img7, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/thesis/9smaller.jpg")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$1, 20, 1, 823);
    			add_location(br9, file$1, 20, 77, 899);
    			attr_dev(img8, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/thesis/10smaller2.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$1, 21, 1, 905);
    			add_location(br10, file$1, 21, 79, 983);
    			attr_dev(img9, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/thesis/11smaller3.jpg")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$1, 22, 1, 989);
    			add_location(br11, file$1, 22, 79, 1067);
    			attr_dev(img10, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/thesis/12smaller.jpg")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$1, 24, 1, 1075);
    			add_location(br12, file$1, 24, 78, 1152);
    			attr_dev(img11, "class", "img portfolio-item svelte-tpjxi");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/thesis/krisa.jpg")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$1, 28, 1, 1323);
    			add_location(br13, file$1, 29, 1, 1398);
    			add_location(br14, file$1, 29, 5, 1402);
    			add_location(br15, file$1, 29, 9, 1406);
    			add_location(br16, file$1, 29, 13, 1410);
    			add_location(br17, file$1, 29, 17, 1414);
    			add_location(br18, file$1, 29, 21, 1418);
    			add_location(br19, file$1, 29, 25, 1422);
    			add_location(br20, file$1, 29, 29, 1426);
    			attr_dev(img12, "class", "img smaller portfolio-item svelte-tpjxi");
    			attr_dev(img12, "alt", "mynd");
    			if (img12.src !== (img12_src_value = "igms/thesis/mobile2.jpg")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$1, 31, 1, 1524);
    			attr_dev(img13, "class", "img smaller portfolio-item svelte-tpjxi");
    			attr_dev(img13, "alt", "mynd");
    			if (img13.src !== (img13_src_value = "igms/thesis/mobile3.jpg")) attr_dev(img13, "src", img13_src_value);
    			add_location(img13, file$1, 32, 1, 1609);
    			add_location(br21, file$1, 32, 84, 1692);
    			attr_dev(img14, "class", "img smaller portfolio-item svelte-tpjxi");
    			attr_dev(img14, "alt", "mynd");
    			if (img14.src !== (img14_src_value = "igms/thesis/mobile5.jpg")) attr_dev(img14, "src", img14_src_value);
    			add_location(img14, file$1, 34, 1, 1790);
    			attr_dev(img15, "class", "img smaller portfolio-item svelte-tpjxi");
    			attr_dev(img15, "alt", "mynd");
    			if (img15.src !== (img15_src_value = "igms/thesis/mobile6.jpg")) attr_dev(img15, "src", img15_src_value);
    			add_location(img15, file$1, 35, 1, 1875);
    			add_location(br22, file$1, 36, 1, 1960);
    			add_location(br23, file$1, 36, 5, 1964);
    			add_location(br24, file$1, 36, 9, 1968);
    			add_location(br25, file$1, 36, 13, 1972);
    			add_location(br26, file$1, 36, 17, 1976);
    			add_location(br27, file$1, 36, 21, 1980);
    			add_location(br28, file$1, 36, 25, 1984);
    			add_location(br29, file$1, 36, 29, 1988);
    			attr_dev(div, "class", "backgroundcolor svelte-tpjxi");
    			add_location(div, file$1, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, br3);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, br4);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, br5);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, br6);
    			append_dev(div, t6);
    			append_dev(div, video);
    			append_dev(video, source);
    			append_dev(video, t7);
    			append_dev(div, br7);
    			append_dev(div, t8);
    			append_dev(div, img6);
    			append_dev(div, br8);
    			append_dev(div, t9);
    			append_dev(div, img7);
    			append_dev(div, br9);
    			append_dev(div, t10);
    			append_dev(div, img8);
    			append_dev(div, br10);
    			append_dev(div, t11);
    			append_dev(div, img9);
    			append_dev(div, br11);
    			append_dev(div, t12);
    			append_dev(div, img10);
    			append_dev(div, br12);
    			append_dev(div, t13);
    			append_dev(div, img11);
    			append_dev(div, t14);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, br18);
    			append_dev(div, br19);
    			append_dev(div, br20);
    			append_dev(div, t15);
    			append_dev(div, img12);
    			append_dev(div, t16);
    			append_dev(div, img13);
    			append_dev(div, br21);
    			append_dev(div, t17);
    			append_dev(div, img14);
    			append_dev(div, t18);
    			append_dev(div, img15);
    			append_dev(div, t19);
    			append_dev(div, br22);
    			append_dev(div, br23);
    			append_dev(div, br24);
    			append_dev(div, br25);
    			append_dev(div, br26);
    			append_dev(div, br27);
    			append_dev(div, br28);
    			append_dev(div, br29);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Green> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Green", $$slots, []);
    	return [];
    }

    class Green extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Green",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/specifics/Vivienne.svelte generated by Svelte v3.23.0 */

    const file$2 = "src/specifics/Vivienne.svelte";

    function create_fragment$2(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let iframe;
    	let iframe_src_value;
    	let t0;
    	let script;
    	let script_src_value;
    	let t1;
    	let br0;
    	let br1;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let br11;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let t2;
    	let img0;
    	let img0_src_value;
    	let br16;
    	let t3;
    	let br17;
    	let br18;
    	let br19;
    	let br20;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let t4;
    	let img1;
    	let img1_src_value;
    	let t5;
    	let img2;
    	let img2_src_value;
    	let t6;
    	let img3;
    	let img3_src_value;
    	let t7;
    	let img4;
    	let img4_src_value;
    	let t8;
    	let img5;
    	let img5_src_value;
    	let t9;
    	let br25;
    	let br26;
    	let br27;
    	let br28;
    	let br29;
    	let br30;
    	let br31;
    	let br32;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			iframe = element("iframe");
    			t0 = space();
    			script = element("script");
    			t1 = space();
    			br0 = element("br");
    			br1 = element("br");
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			t2 = space();
    			img0 = element("img");
    			br16 = element("br");
    			t3 = space();
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			t4 = space();
    			img1 = element("img");
    			t5 = space();
    			img2 = element("img");
    			t6 = space();
    			img3 = element("img");
    			t7 = space();
    			img4 = element("img");
    			t8 = space();
    			img5 = element("img");
    			t9 = space();
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			br29 = element("br");
    			br30 = element("br");
    			br31 = element("br");
    			br32 = element("br");
    			attr_dev(iframe, "title", "book");
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/331654391?autoplay=1&loop=1&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			set_style(iframe, "position", "absolute");
    			set_style(iframe, "top", "0");
    			set_style(iframe, "left", "0");
    			set_style(iframe, "width", "96%");
    			set_style(iframe, "height", "100%");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$2, 14, 6, 249);
    			set_style(div0, "padding", "36.16% 0 0 0");
    			set_style(div0, "position", "relative");
    			add_location(div0, file$2, 13, 5, 189);
    			if (script.src !== (script_src_value = "https://player.vimeo.com/api/player.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$2, 16, 5, 513);
    			set_style(div1, "position", "relative");
    			set_style(div1, "top", "20%");
    			set_style(div1, "left", "2%");
    			set_style(div1, "right", "2%");
    			set_style(div1, "height", "auto");
    			set_style(div1, "padding-bottom", "2%");
    			add_location(div1, file$2, 6, 1, 54);
    			add_location(br0, file$2, 18, 1, 585);
    			add_location(br1, file$2, 18, 5, 589);
    			add_location(br2, file$2, 18, 9, 593);
    			add_location(br3, file$2, 18, 13, 597);
    			add_location(br4, file$2, 18, 17, 601);
    			add_location(br5, file$2, 18, 21, 605);
    			add_location(br6, file$2, 18, 25, 609);
    			add_location(br7, file$2, 18, 29, 613);
    			add_location(br8, file$2, 18, 33, 617);
    			add_location(br9, file$2, 18, 37, 621);
    			add_location(br10, file$2, 18, 41, 625);
    			add_location(br11, file$2, 18, 45, 629);
    			add_location(br12, file$2, 18, 49, 633);
    			add_location(br13, file$2, 18, 53, 637);
    			add_location(br14, file$2, 18, 57, 641);
    			add_location(br15, file$2, 18, 61, 645);
    			attr_dev(img0, "class", "img poster svelte-jup5om");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/viv/poster.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$2, 19, 1, 651);
    			add_location(br16, file$2, 19, 64, 714);
    			add_location(br17, file$2, 20, 1, 720);
    			add_location(br18, file$2, 20, 5, 724);
    			add_location(br19, file$2, 20, 9, 728);
    			add_location(br20, file$2, 20, 13, 732);
    			add_location(br21, file$2, 20, 17, 736);
    			add_location(br22, file$2, 20, 21, 740);
    			add_location(br23, file$2, 20, 25, 744);
    			add_location(br24, file$2, 20, 29, 748);
    			attr_dev(img1, "class", "img svelte-jup5om");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/viv/22B.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$2, 21, 1, 754);
    			attr_dev(img2, "class", "img svelte-jup5om");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/viv/38A.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$2, 22, 1, 809);
    			attr_dev(img3, "class", "img svelte-jup5om");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/viv/41A.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$2, 23, 1, 864);
    			attr_dev(img4, "class", "img svelte-jup5om");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/viv/42A.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$2, 24, 1, 919);
    			attr_dev(img5, "class", "img svelte-jup5om");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/viv/44A.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$2, 25, 1, 974);
    			add_location(br25, file$2, 26, 1, 1029);
    			add_location(br26, file$2, 26, 5, 1033);
    			add_location(br27, file$2, 26, 9, 1037);
    			add_location(br28, file$2, 26, 13, 1041);
    			add_location(br29, file$2, 26, 17, 1045);
    			add_location(br30, file$2, 26, 21, 1049);
    			add_location(br31, file$2, 26, 25, 1053);
    			add_location(br32, file$2, 26, 29, 1057);
    			attr_dev(div2, "class", "backgroundcolor svelte-jup5om");
    			add_location(div2, file$2, 4, 0, 22);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    			append_dev(div1, t0);
    			append_dev(div1, script);
    			append_dev(div2, t1);
    			append_dev(div2, br0);
    			append_dev(div2, br1);
    			append_dev(div2, br2);
    			append_dev(div2, br3);
    			append_dev(div2, br4);
    			append_dev(div2, br5);
    			append_dev(div2, br6);
    			append_dev(div2, br7);
    			append_dev(div2, br8);
    			append_dev(div2, br9);
    			append_dev(div2, br10);
    			append_dev(div2, br11);
    			append_dev(div2, br12);
    			append_dev(div2, br13);
    			append_dev(div2, br14);
    			append_dev(div2, br15);
    			append_dev(div2, t2);
    			append_dev(div2, img0);
    			append_dev(div2, br16);
    			append_dev(div2, t3);
    			append_dev(div2, br17);
    			append_dev(div2, br18);
    			append_dev(div2, br19);
    			append_dev(div2, br20);
    			append_dev(div2, br21);
    			append_dev(div2, br22);
    			append_dev(div2, br23);
    			append_dev(div2, br24);
    			append_dev(div2, t4);
    			append_dev(div2, img1);
    			append_dev(div2, t5);
    			append_dev(div2, img2);
    			append_dev(div2, t6);
    			append_dev(div2, img3);
    			append_dev(div2, t7);
    			append_dev(div2, img4);
    			append_dev(div2, t8);
    			append_dev(div2, img5);
    			append_dev(div2, t9);
    			append_dev(div2, br25);
    			append_dev(div2, br26);
    			append_dev(div2, br27);
    			append_dev(div2, br28);
    			append_dev(div2, br29);
    			append_dev(div2, br30);
    			append_dev(div2, br31);
    			append_dev(div2, br32);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Vivienne> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Vivienne", $$slots, []);
    	return [];
    }

    class Vivienne extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Vivienne",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/specifics/Portfolioio.svelte generated by Svelte v3.23.0 */

    const file$3 = "src/specifics/Portfolioio.svelte";

    function create_fragment$3(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br3;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let br4;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let br5;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let br6;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let br7;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let br8;
    	let t8;
    	let img8;
    	let img8_src_value;
    	let t9;
    	let img9;
    	let img9_src_value;
    	let t10;
    	let br9;
    	let br10;
    	let br11;
    	let br12;
    	let br13;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			br3 = element("br");
    			t2 = space();
    			img2 = element("img");
    			br4 = element("br");
    			t3 = space();
    			img3 = element("img");
    			br5 = element("br");
    			t4 = space();
    			img4 = element("img");
    			br6 = element("br");
    			t5 = space();
    			img5 = element("img");
    			br7 = element("br");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			img7 = element("img");
    			br8 = element("br");
    			t8 = space();
    			img8 = element("img");
    			t9 = space();
    			img9 = element("img");
    			t10 = space();
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			add_location(br0, file$3, 6, 1, 54);
    			add_location(br1, file$3, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-kx3kpm");
    			if (img0.src !== (img0_src_value = "igms/io/1.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$3, 8, 1, 66);
    			add_location(br2, file$3, 8, 55, 120);
    			attr_dev(img1, "class", "img portfolio-item svelte-kx3kpm");
    			if (img1.src !== (img1_src_value = "igms/io/2.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$3, 9, 1, 126);
    			add_location(br3, file$3, 9, 55, 180);
    			attr_dev(img2, "class", "img portfolio-item svelte-kx3kpm");
    			if (img2.src !== (img2_src_value = "igms/io/3.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$3, 10, 1, 186);
    			add_location(br4, file$3, 10, 55, 240);
    			attr_dev(img3, "class", "img portfolio-item svelte-kx3kpm");
    			if (img3.src !== (img3_src_value = "igms/io/5.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$3, 12, 1, 313);
    			add_location(br5, file$3, 12, 55, 367);
    			attr_dev(img4, "class", "img portfolio-item svelte-kx3kpm");
    			if (img4.src !== (img4_src_value = "igms/io/6.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$3, 13, 1, 373);
    			add_location(br6, file$3, 13, 55, 427);
    			attr_dev(img5, "class", "img portfolio-item svelte-kx3kpm");
    			if (img5.src !== (img5_src_value = "igms/io/7.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$3, 14, 1, 433);
    			add_location(br7, file$3, 14, 55, 487);
    			attr_dev(img6, "class", "img portfolio-item svelte-kx3kpm");
    			if (img6.src !== (img6_src_value = "igms/io/8.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$3, 15, 1, 493);
    			attr_dev(img7, "class", "img portfolio-item svelte-kx3kpm");
    			if (img7.src !== (img7_src_value = "igms/io/allblurred10.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$3, 16, 1, 549);
    			add_location(br8, file$3, 16, 66, 614);
    			attr_dev(img8, "class", "img portfolio-item svelte-kx3kpm");
    			if (img8.src !== (img8_src_value = "igms/io/9.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$3, 17, 1, 620);
    			attr_dev(img9, "class", "img portfolio-item svelte-kx3kpm");
    			if (img9.src !== (img9_src_value = "igms/io/10.jpg")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$3, 18, 1, 676);
    			add_location(br9, file$3, 19, 1, 733);
    			add_location(br10, file$3, 19, 5, 737);
    			add_location(br11, file$3, 19, 9, 741);
    			add_location(br12, file$3, 19, 13, 745);
    			add_location(br13, file$3, 19, 17, 749);
    			attr_dev(div, "class", "backgroundcolor svelte-kx3kpm");
    			add_location(div, file$3, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br3);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, br4);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, br5);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, br6);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, br7);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, br8);
    			append_dev(div, t8);
    			append_dev(div, img8);
    			append_dev(div, t9);
    			append_dev(div, img9);
    			append_dev(div, t10);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, br13);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Portfolioio> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Portfolioio", $$slots, []);
    	return [];
    }

    class Portfolioio extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Portfolioio",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/specifics/Typoposters.svelte generated by Svelte v3.23.0 */

    const file$4 = "src/specifics/Typoposters.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br3;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let br4;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let br5;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let br6;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let br7;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let br8;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let br9;
    	let t8;
    	let br10;
    	let br11;
    	let br12;
    	let br13;
    	let br14;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			br3 = element("br");
    			t2 = space();
    			img2 = element("img");
    			br4 = element("br");
    			t3 = space();
    			img3 = element("img");
    			br5 = element("br");
    			t4 = space();
    			img4 = element("img");
    			br6 = element("br");
    			t5 = space();
    			img5 = element("img");
    			br7 = element("br");
    			t6 = space();
    			img6 = element("img");
    			br8 = element("br");
    			t7 = space();
    			img7 = element("img");
    			br9 = element("br");
    			t8 = space();
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			add_location(br0, file$4, 6, 1, 54);
    			add_location(br1, file$4, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img0.src !== (img0_src_value = "igms/typoPosters/3.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$4, 7, 1, 64);
    			add_location(br2, file$4, 7, 73, 136);
    			attr_dev(img1, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img1.src !== (img1_src_value = "igms/typoPosters/4.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$4, 8, 1, 142);
    			add_location(br3, file$4, 8, 73, 214);
    			attr_dev(img2, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img2.src !== (img2_src_value = "igms/typoPosters/puffwind2.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$4, 9, 1, 220);
    			add_location(br4, file$4, 9, 72, 291);
    			attr_dev(img3, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img3.src !== (img3_src_value = "igms/typoPosters/1.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$4, 10, 1, 297);
    			add_location(br5, file$4, 10, 73, 369);
    			attr_dev(img4, "class", "img portfolio-item smaller svelte-1oyu8g9");
    			if (img4.src !== (img4_src_value = "igms/typoPosters/arial2.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$4, 12, 1, 456);
    			add_location(br6, file$4, 12, 77, 532);
    			attr_dev(img5, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img5.src !== (img5_src_value = "igms/typoPosters/7.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$4, 13, 1, 538);
    			add_location(br7, file$4, 13, 73, 610);
    			attr_dev(img6, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img6.src !== (img6_src_value = "igms/typoPosters/5.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$4, 14, 1, 616);
    			add_location(br8, file$4, 14, 73, 688);
    			attr_dev(img7, "class", "img portfolio-item svelte-1oyu8g9");
    			if (img7.src !== (img7_src_value = "igms/typoPosters/2.jpg")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$4, 15, 1, 694);
    			add_location(br9, file$4, 15, 73, 766);
    			add_location(br10, file$4, 16, 1, 772);
    			add_location(br11, file$4, 16, 5, 776);
    			add_location(br12, file$4, 16, 9, 780);
    			add_location(br13, file$4, 16, 13, 784);
    			add_location(br14, file$4, 16, 17, 788);
    			attr_dev(div, "class", "backgroundcolor svelte-1oyu8g9");
    			add_location(div, file$4, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br3);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, br4);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, br5);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, br6);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, br7);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, br8);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, br9);
    			append_dev(div, t8);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Typoposters> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Typoposters", $$slots, []);
    	return [];
    }

    class Typoposters extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Typoposters",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/specifics/Secret.svelte generated by Svelte v3.23.0 */

    const file$5 = "src/specifics/Secret.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			add_location(br0, file$5, 6, 1, 54);
    			add_location(br1, file$5, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item smaller svelte-197gr3d");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/secret/front.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$5, 7, 1, 64);
    			attr_dev(img1, "class", "img portfolio-item smaller svelte-197gr3d");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/secret/2.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$5, 9, 1, 237);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-197gr3d");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/secret/3.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$5, 10, 1, 316);
    			attr_dev(img3, "class", "img portfolio-item svelte-197gr3d");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/secret/4.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$5, 11, 1, 395);
    			attr_dev(img4, "class", "img portfolio-item svelte-197gr3d");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/secret/5.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$5, 13, 1, 468);
    			add_location(br2, file$5, 14, 1, 539);
    			add_location(br3, file$5, 14, 5, 543);
    			add_location(br4, file$5, 14, 9, 547);
    			add_location(br5, file$5, 14, 13, 551);
    			add_location(br6, file$5, 14, 17, 555);
    			add_location(br7, file$5, 14, 21, 559);
    			add_location(br8, file$5, 14, 25, 563);
    			add_location(br9, file$5, 14, 29, 567);
    			attr_dev(div, "class", "backgroundcolor svelte-197gr3d");
    			add_location(div, file$5, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, br2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Secret> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Secret", $$slots, []);
    	return [];
    }

    class Secret extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Secret",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/specifics/sorted-plastic.svelte generated by Svelte v3.23.0 */

    const file$6 = "src/specifics/sorted-plastic.svelte";

    function create_fragment$6(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br2;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let t8;
    	let img8;
    	let img8_src_value;
    	let t9;
    	let img9;
    	let img9_src_value;
    	let br3;
    	let t10;
    	let img10;
    	let img10_src_value;
    	let t11;
    	let img11;
    	let img11_src_value;
    	let t12;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let br11;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			br2 = element("br");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			img5 = element("img");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			img7 = element("img");
    			t8 = space();
    			img8 = element("img");
    			t9 = space();
    			img9 = element("img");
    			br3 = element("br");
    			t10 = space();
    			img10 = element("img");
    			t11 = space();
    			img11 = element("img");
    			t12 = space();
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			add_location(br0, file$6, 6, 1, 54);
    			add_location(br1, file$6, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/sortedPlastic/front.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$6, 7, 1, 64);
    			attr_dev(img1, "class", "img portfolio-item svelte-io3dfd");
    			set_style(img1, "border-radius", "30px");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/sortedPlastic/intro.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$6, 8, 1, 146);
    			add_location(br2, file$6, 8, 110, 255);
    			attr_dev(img2, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/sortedPlastic/3-4.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$6, 9, 1, 261);
    			attr_dev(img3, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/sortedPlastic/5-6.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$6, 10, 1, 341);
    			attr_dev(img4, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/sortedPlastic/8-9.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$6, 11, 1, 421);
    			attr_dev(img5, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/sortedPlastic/11-12.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$6, 12, 1, 501);
    			attr_dev(img6, "class", "img portfolio-item svelte-io3dfd");
    			set_style(img6, "border-radius", "30px");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/sortedPlastic/detail.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$6, 13, 1, 583);
    			attr_dev(img7, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/sortedPlastic/14-15.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$6, 14, 1, 695);
    			attr_dev(img8, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/sortedPlastic/17-18.png")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$6, 15, 1, 777);
    			attr_dev(img9, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/sortedPlastic/20-21.png")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$6, 16, 1, 859);
    			add_location(br3, file$6, 16, 81, 939);
    			attr_dev(img10, "class", "img portfolio-item svelte-io3dfd");
    			set_style(img10, "border-radius", "30px");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/sortedPlastic/lol.jpg")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$6, 17, 1, 945);
    			attr_dev(img11, "class", "img portfolio-item svelte-io3dfd");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/sortedPlastic/back.png")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$6, 18, 1, 1054);
    			add_location(br4, file$6, 19, 1, 1135);
    			add_location(br5, file$6, 19, 5, 1139);
    			add_location(br6, file$6, 19, 9, 1143);
    			add_location(br7, file$6, 19, 13, 1147);
    			add_location(br8, file$6, 19, 17, 1151);
    			add_location(br9, file$6, 19, 21, 1155);
    			add_location(br10, file$6, 19, 25, 1159);
    			add_location(br11, file$6, 19, 29, 1163);
    			attr_dev(div, "class", "backgroundcolor svelte-io3dfd");
    			add_location(div, file$6, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, t8);
    			append_dev(div, img8);
    			append_dev(div, t9);
    			append_dev(div, img9);
    			append_dev(div, br3);
    			append_dev(div, t10);
    			append_dev(div, img10);
    			append_dev(div, t11);
    			append_dev(div, img11);
    			append_dev(div, t12);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, br11);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Sorted_plastic> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Sorted_plastic", $$slots, []);
    	return [];
    }

    class Sorted_plastic extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sorted_plastic",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/specifics/musicposters.svelte generated by Svelte v3.23.0 */

    const file$7 = "src/specifics/musicposters.svelte";

    function create_fragment$7(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br2;
    	let t2;
    	let iframe0;
    	let iframe0_src_value;
    	let t3;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let t4;
    	let img2;
    	let img2_src_value;
    	let t5;
    	let img3;
    	let img3_src_value;
    	let br11;
    	let t6;
    	let iframe1;
    	let iframe1_src_value;
    	let t7;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let br18;
    	let br19;
    	let t8;
    	let img4;
    	let img4_src_value;
    	let t9;
    	let img5;
    	let img5_src_value;
    	let br20;
    	let t10;
    	let iframe2;
    	let iframe2_src_value;
    	let t11;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let br25;
    	let br26;
    	let br27;
    	let br28;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			br2 = element("br");
    			t2 = space();
    			iframe0 = element("iframe");
    			t3 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			t4 = space();
    			img2 = element("img");
    			t5 = space();
    			img3 = element("img");
    			br11 = element("br");
    			t6 = space();
    			iframe1 = element("iframe");
    			t7 = space();
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			t8 = space();
    			img4 = element("img");
    			t9 = space();
    			img5 = element("img");
    			br20 = element("br");
    			t10 = space();
    			iframe2 = element("iframe");
    			t11 = space();
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			add_location(br0, file$7, 6, 1, 54);
    			add_location(br1, file$7, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-1uwsbkp");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/musicPosters/1.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$7, 7, 1, 64);
    			attr_dev(img1, "class", "img portfolio-item svelte-1uwsbkp");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/musicPosters/1b.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$7, 8, 1, 141);
    			add_location(br2, file$7, 8, 77, 217);
    			attr_dev(iframe0, "width", "560");
    			attr_dev(iframe0, "height", "315");
    			if (iframe0.src !== (iframe0_src_value = "https://www.youtube.com/embed/Lc0i2iDuAfE")) attr_dev(iframe0, "src", iframe0_src_value);
    			attr_dev(iframe0, "frameborder", "0");
    			attr_dev(iframe0, "allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture");
    			iframe0.allowFullscreen = true;
    			attr_dev(iframe0, "class", "svelte-1uwsbkp");
    			add_location(iframe0, file$7, 9, 1, 223);
    			add_location(br3, file$7, 10, 1, 427);
    			add_location(br4, file$7, 10, 5, 431);
    			add_location(br5, file$7, 10, 9, 435);
    			add_location(br6, file$7, 10, 13, 439);
    			add_location(br7, file$7, 10, 17, 443);
    			add_location(br8, file$7, 10, 21, 447);
    			add_location(br9, file$7, 10, 25, 451);
    			add_location(br10, file$7, 10, 29, 455);
    			attr_dev(img2, "class", "img portfolio-item svelte-1uwsbkp");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/musicPosters/2.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$7, 11, 1, 461);
    			attr_dev(img3, "class", "img portfolio-item svelte-1uwsbkp");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/musicPosters/2b.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$7, 12, 1, 538);
    			add_location(br11, file$7, 12, 77, 614);
    			attr_dev(iframe1, "width", "560");
    			attr_dev(iframe1, "height", "315");
    			if (iframe1.src !== (iframe1_src_value = "https://www.youtube.com/embed/UKt-zMH8c3c")) attr_dev(iframe1, "src", iframe1_src_value);
    			attr_dev(iframe1, "frameborder", "0");
    			attr_dev(iframe1, "allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture");
    			iframe1.allowFullscreen = true;
    			attr_dev(iframe1, "class", "svelte-1uwsbkp");
    			add_location(iframe1, file$7, 13, 1, 620);
    			add_location(br12, file$7, 14, 1, 825);
    			add_location(br13, file$7, 14, 5, 829);
    			add_location(br14, file$7, 14, 9, 833);
    			add_location(br15, file$7, 14, 13, 837);
    			add_location(br16, file$7, 14, 17, 841);
    			add_location(br17, file$7, 14, 21, 845);
    			add_location(br18, file$7, 14, 25, 849);
    			add_location(br19, file$7, 14, 29, 853);
    			attr_dev(img4, "class", "img portfolio-item svelte-1uwsbkp");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/musicPosters/3.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$7, 15, 1, 859);
    			attr_dev(img5, "class", "img portfolio-item svelte-1uwsbkp");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/musicPosters/3b.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$7, 16, 1, 936);
    			add_location(br20, file$7, 16, 77, 1012);
    			attr_dev(iframe2, "width", "560");
    			attr_dev(iframe2, "height", "315");
    			if (iframe2.src !== (iframe2_src_value = "https://www.youtube.com/embed/87berJKi2ek")) attr_dev(iframe2, "src", iframe2_src_value);
    			attr_dev(iframe2, "frameborder", "0");
    			attr_dev(iframe2, "allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture");
    			iframe2.allowFullscreen = true;
    			attr_dev(iframe2, "class", "svelte-1uwsbkp");
    			add_location(iframe2, file$7, 17, 1, 1018);
    			add_location(br21, file$7, 18, 1, 1222);
    			add_location(br22, file$7, 18, 5, 1226);
    			add_location(br23, file$7, 18, 9, 1230);
    			add_location(br24, file$7, 18, 13, 1234);
    			add_location(br25, file$7, 18, 17, 1238);
    			add_location(br26, file$7, 18, 21, 1242);
    			add_location(br27, file$7, 18, 25, 1246);
    			add_location(br28, file$7, 18, 29, 1250);
    			attr_dev(div, "class", "backgroundcolor svelte-1uwsbkp");
    			add_location(div, file$7, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, iframe0);
    			append_dev(div, t3);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, t4);
    			append_dev(div, img2);
    			append_dev(div, t5);
    			append_dev(div, img3);
    			append_dev(div, br11);
    			append_dev(div, t6);
    			append_dev(div, iframe1);
    			append_dev(div, t7);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, br18);
    			append_dev(div, br19);
    			append_dev(div, t8);
    			append_dev(div, img4);
    			append_dev(div, t9);
    			append_dev(div, img5);
    			append_dev(div, br20);
    			append_dev(div, t10);
    			append_dev(div, iframe2);
    			append_dev(div, t11);
    			append_dev(div, br21);
    			append_dev(div, br22);
    			append_dev(div, br23);
    			append_dev(div, br24);
    			append_dev(div, br25);
    			append_dev(div, br26);
    			append_dev(div, br27);
    			append_dev(div, br28);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Musicposters> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Musicposters", $$slots, []);
    	return [];
    }

    class Musicposters extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Musicposters",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/specifics/Timatal.svelte generated by Svelte v3.23.0 */

    const file$8 = "src/specifics/Timatal.svelte";

    function create_fragment$8(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let t8;
    	let img8;
    	let img8_src_value;
    	let t9;
    	let img9;
    	let img9_src_value;
    	let t10;
    	let img10;
    	let img10_src_value;
    	let t11;
    	let img11;
    	let img11_src_value;
    	let t12;
    	let img12;
    	let img12_src_value;
    	let t13;
    	let img13;
    	let img13_src_value;
    	let t14;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			img5 = element("img");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			img7 = element("img");
    			t8 = space();
    			img8 = element("img");
    			t9 = space();
    			img9 = element("img");
    			t10 = space();
    			img10 = element("img");
    			t11 = space();
    			img11 = element("img");
    			t12 = space();
    			img12 = element("img");
    			t13 = space();
    			img13 = element("img");
    			t14 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			add_location(br0, file$8, 6, 1, 54);
    			add_location(br1, file$8, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-n5j4iw");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/timatal/sammen.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$8, 7, 1, 64);
    			add_location(br2, file$8, 7, 76, 139);
    			attr_dev(img1, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/timatal/1.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$8, 8, 1, 145);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/timatal/2.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$8, 9, 1, 225);
    			attr_dev(img3, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/timatal/3.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$8, 10, 1, 305);
    			attr_dev(img4, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/timatal/5.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$8, 11, 1, 385);
    			attr_dev(img5, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/timatal/6.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$8, 12, 1, 465);
    			attr_dev(img6, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/timatal/4.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$8, 13, 1, 545);
    			attr_dev(img7, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/timatal/7.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$8, 16, 1, 629);
    			attr_dev(img8, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/timatal/8.png")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$8, 17, 1, 709);
    			attr_dev(img9, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/timatal/9.png")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$8, 18, 1, 789);
    			attr_dev(img10, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/timatal/11.png")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$8, 20, 1, 871);
    			attr_dev(img11, "class", "img portfolio-item smaller svelte-n5j4iw");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/timatal/10.png")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$8, 21, 1, 952);
    			attr_dev(img12, "class", "img portfolio-item svelte-n5j4iw");
    			attr_dev(img12, "alt", "mynd");
    			if (img12.src !== (img12_src_value = "igms/timatal/sammen2.png")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$8, 22, 1, 1033);
    			attr_dev(img13, "class", "img portfolio-item lastpic svelte-n5j4iw");
    			attr_dev(img13, "alt", "mynd");
    			if (img13.src !== (img13_src_value = "igms/timatal/uppst.jpg")) attr_dev(img13, "src", img13_src_value);
    			add_location(img13, file$8, 23, 1, 1111);
    			add_location(br3, file$8, 24, 1, 1195);
    			add_location(br4, file$8, 24, 5, 1199);
    			add_location(br5, file$8, 24, 9, 1203);
    			add_location(br6, file$8, 24, 13, 1207);
    			add_location(br7, file$8, 24, 17, 1211);
    			add_location(br8, file$8, 24, 21, 1215);
    			add_location(br9, file$8, 24, 25, 1219);
    			add_location(br10, file$8, 24, 29, 1223);
    			attr_dev(div, "class", "backgroundcolor svelte-n5j4iw");
    			add_location(div, file$8, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, t8);
    			append_dev(div, img8);
    			append_dev(div, t9);
    			append_dev(div, img9);
    			append_dev(div, t10);
    			append_dev(div, img10);
    			append_dev(div, t11);
    			append_dev(div, img11);
    			append_dev(div, t12);
    			append_dev(div, img12);
    			append_dev(div, t13);
    			append_dev(div, img13);
    			append_dev(div, t14);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Timatal> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Timatal", $$slots, []);
    	return [];
    }

    class Timatal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Timatal",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src/specifics/ToolsOfExpression.svelte generated by Svelte v3.23.0 */

    const file$9 = "src/specifics/ToolsOfExpression.svelte";

    function create_fragment$9(ctx) {
    	let div;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let img1;
    	let img1_src_value;
    	let t1;
    	let img2;
    	let img2_src_value;
    	let t2;
    	let img3;
    	let img3_src_value;
    	let t3;
    	let img4;
    	let img4_src_value;
    	let t4;
    	let img5;
    	let img5_src_value;
    	let t5;
    	let img6;
    	let img6_src_value;
    	let t6;
    	let img7;
    	let img7_src_value;
    	let t7;
    	let img8;
    	let img8_src_value;
    	let t8;
    	let img9;
    	let img9_src_value;
    	let t9;
    	let img10;
    	let img10_src_value;
    	let br0;
    	let t10;
    	let img11;
    	let img11_src_value;
    	let t11;
    	let br1;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img0 = element("img");
    			t0 = space();
    			img1 = element("img");
    			t1 = space();
    			img2 = element("img");
    			t2 = space();
    			img3 = element("img");
    			t3 = space();
    			img4 = element("img");
    			t4 = space();
    			img5 = element("img");
    			t5 = space();
    			img6 = element("img");
    			t6 = space();
    			img7 = element("img");
    			t7 = space();
    			img8 = element("img");
    			t8 = space();
    			img9 = element("img");
    			t9 = space();
    			img10 = element("img");
    			br0 = element("br");
    			t10 = space();
    			img11 = element("img");
    			t11 = space();
    			br1 = element("br");
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			attr_dev(img0, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/tools/1.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$9, 6, 1, 54);
    			attr_dev(img1, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/tools/2.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$9, 7, 1, 124);
    			attr_dev(img2, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/tools/3.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$9, 8, 1, 194);
    			attr_dev(img3, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/tools/4.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$9, 9, 1, 264);
    			attr_dev(img4, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/tools/5.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$9, 10, 1, 334);
    			attr_dev(img5, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/tools/6.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$9, 11, 1, 404);
    			attr_dev(img6, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/tools/7.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$9, 12, 1, 474);
    			attr_dev(img7, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/tools/9.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$9, 13, 1, 544);
    			attr_dev(img8, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/tools/10.png")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$9, 14, 1, 614);
    			attr_dev(img9, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/tools/11.png")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$9, 15, 1, 685);
    			attr_dev(img10, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/tools/12.png")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$9, 16, 1, 756);
    			add_location(br0, file$9, 16, 70, 825);
    			attr_dev(img11, "class", "img portfolio-item svelte-prshb0");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/tools/tools.png")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$9, 17, 1, 831);
    			add_location(br1, file$9, 18, 1, 905);
    			add_location(br2, file$9, 18, 5, 909);
    			add_location(br3, file$9, 18, 9, 913);
    			add_location(br4, file$9, 18, 13, 917);
    			add_location(br5, file$9, 18, 17, 921);
    			add_location(br6, file$9, 18, 21, 925);
    			add_location(br7, file$9, 18, 25, 929);
    			add_location(br8, file$9, 18, 29, 933);
    			attr_dev(div, "class", "backgroundcolor svelte-prshb0");
    			add_location(div, file$9, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, img0);
    			append_dev(div, t0);
    			append_dev(div, img1);
    			append_dev(div, t1);
    			append_dev(div, img2);
    			append_dev(div, t2);
    			append_dev(div, img3);
    			append_dev(div, t3);
    			append_dev(div, img4);
    			append_dev(div, t4);
    			append_dev(div, img5);
    			append_dev(div, t5);
    			append_dev(div, img6);
    			append_dev(div, t6);
    			append_dev(div, img7);
    			append_dev(div, t7);
    			append_dev(div, img8);
    			append_dev(div, t8);
    			append_dev(div, img9);
    			append_dev(div, t9);
    			append_dev(div, img10);
    			append_dev(div, br0);
    			append_dev(div, t10);
    			append_dev(div, img11);
    			append_dev(div, t11);
    			append_dev(div, br1);
    			append_dev(div, br2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<ToolsOfExpression> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("ToolsOfExpression", $$slots, []);
    	return [];
    }

    class ToolsOfExpression extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ToolsOfExpression",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src/specifics/Trash.svelte generated by Svelte v3.23.0 */

    const file$a = "src/specifics/Trash.svelte";

    function create_fragment$a(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let br2;
    	let t2;
    	let img1;
    	let img1_src_value;
    	let t3;
    	let img2;
    	let img2_src_value;
    	let t4;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			br2 = element("br");
    			t2 = space();
    			img1 = element("img");
    			t3 = space();
    			img2 = element("img");
    			t4 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			add_location(br0, file$a, 6, 1, 54);
    			add_location(br1, file$a, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-zqi07z");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/trash/4.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$a, 7, 1, 64);
    			add_location(br2, file$a, 8, 1, 134);
    			attr_dev(img1, "class", "img portfolio-item svelte-zqi07z");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/trash/1.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$a, 9, 1, 140);
    			attr_dev(img2, "class", "img portfolio-item svelte-zqi07z");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/trash/1.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$a, 10, 1, 210);
    			add_location(br3, file$a, 11, 1, 280);
    			add_location(br4, file$a, 11, 5, 284);
    			add_location(br5, file$a, 11, 9, 288);
    			add_location(br6, file$a, 11, 13, 292);
    			add_location(br7, file$a, 11, 17, 296);
    			add_location(br8, file$a, 11, 21, 300);
    			add_location(br9, file$a, 11, 25, 304);
    			add_location(br10, file$a, 11, 29, 308);
    			attr_dev(div, "class", "backgroundcolor svelte-zqi07z");
    			add_location(div, file$a, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, img1);
    			append_dev(div, t3);
    			append_dev(div, img2);
    			append_dev(div, t4);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Trash> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Trash", $$slots, []);
    	return [];
    }

    class Trash extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Trash",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src/specifics/MusicBook.svelte generated by Svelte v3.23.0 */

    const file$b = "src/specifics/MusicBook.svelte";

    function create_fragment$b(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let t8;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let t9;
    	let iframe;
    	let iframe_src_value;
    	let t10;
    	let p;
    	let t12;
    	let br10;
    	let br11;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			img5 = element("img");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			img7 = element("img");
    			t8 = space();
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			t9 = space();
    			iframe = element("iframe");
    			t10 = space();
    			p = element("p");
    			p.textContent = "***Watch/listen with headphones***";
    			t12 = space();
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			add_location(br0, file$b, 6, 1, 54);
    			add_location(br1, file$b, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item smaller svelte-1av7bfc");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/musicBook/front.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$b, 7, 1, 64);
    			attr_dev(img1, "class", "img portfolio-item smaller svelte-1av7bfc");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/musicBook/back.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$b, 8, 1, 150);
    			attr_dev(img2, "class", "img portfolio-item svelte-1av7bfc");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/musicBook/6.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$b, 9, 1, 235);
    			attr_dev(img3, "class", "img portfolio-item svelte-1av7bfc");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/musicBook/5.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$b, 10, 1, 309);
    			attr_dev(img4, "class", "img portfolio-item svelte-1av7bfc");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/musicBook/4.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$b, 11, 1, 383);
    			attr_dev(img5, "class", "img portfolio-item svelte-1av7bfc");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/musicBook/3.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$b, 12, 1, 457);
    			attr_dev(img6, "class", "img portfolio-item svelte-1av7bfc");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/musicBook/2.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$b, 13, 1, 531);
    			attr_dev(img7, "class", "img portfolio-item svelte-1av7bfc");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/musicBook/1.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$b, 14, 1, 605);
    			add_location(br2, file$b, 15, 1, 679);
    			add_location(br3, file$b, 15, 5, 683);
    			add_location(br4, file$b, 15, 9, 687);
    			add_location(br5, file$b, 15, 13, 691);
    			add_location(br6, file$b, 15, 17, 695);
    			add_location(br7, file$b, 15, 21, 699);
    			add_location(br8, file$b, 15, 25, 703);
    			add_location(br9, file$b, 15, 29, 707);
    			attr_dev(iframe, "width", "60%");
    			attr_dev(iframe, "height", "70%");
    			if (iframe.src !== (iframe_src_value = "https://www.youtube.com/embed/F-RqTOuxzdA?rel=0&controls=0&showinfo=0")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; encrypted-media");
    			iframe.allowFullscreen = true;
    			attr_dev(iframe, "class", "svelte-1av7bfc");
    			add_location(iframe, file$b, 16, 1, 713);
    			add_location(p, file$b, 17, 1, 907);
    			add_location(br10, file$b, 18, 1, 950);
    			add_location(br11, file$b, 18, 5, 954);
    			add_location(br12, file$b, 18, 9, 958);
    			add_location(br13, file$b, 18, 13, 962);
    			add_location(br14, file$b, 18, 17, 966);
    			add_location(br15, file$b, 18, 21, 970);
    			add_location(br16, file$b, 18, 25, 974);
    			add_location(br17, file$b, 18, 29, 978);
    			attr_dev(div, "class", "backgroundcolor svelte-1av7bfc");
    			add_location(div, file$b, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, t8);
    			append_dev(div, br2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, t9);
    			append_dev(div, iframe);
    			append_dev(div, t10);
    			append_dev(div, p);
    			append_dev(div, t12);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<MusicBook> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("MusicBook", $$slots, []);
    	return [];
    }

    class MusicBook extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MusicBook",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    /* src/specifics/Corrupted.svelte generated by Svelte v3.23.0 */

    const file$c = "src/specifics/Corrupted.svelte";

    function create_fragment$c(ctx) {
    	let div1;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br3;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let br4;
    	let t3;
    	let div0;
    	let iframe;
    	let iframe_src_value;
    	let script;
    	let script_src_value;
    	let t4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let br11;
    	let br12;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			br3 = element("br");
    			t2 = space();
    			img2 = element("img");
    			br4 = element("br");
    			t3 = space();
    			div0 = element("div");
    			iframe = element("iframe");
    			script = element("script");
    			t4 = space();
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			add_location(br0, file$c, 6, 1, 54);
    			add_location(br1, file$c, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-1r4jk2k");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/corruptedspace/1.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$c, 7, 1, 64);
    			add_location(br2, file$c, 7, 78, 141);
    			attr_dev(img1, "class", "img portfolio-item svelte-1r4jk2k");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/corruptedspace/2.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$c, 8, 1, 147);
    			add_location(br3, file$c, 8, 78, 224);
    			attr_dev(img2, "class", "img portfolio-item svelte-1r4jk2k");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/corruptedspace/3.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$c, 9, 1, 230);
    			add_location(br4, file$c, 9, 78, 307);
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/329483614?autoplay=1&loop=1&color=ffffff&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "class", "video-vidd svelte-1r4jk2k");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$c, 11, 51, 364);
    			set_style(div0, "padding", "36% 0 0 0");
    			set_style(div0, "position", "relative");
    			add_location(div0, file$c, 11, 1, 314);
    			if (script.src !== (script_src_value = "https://player.vimeo.com/api/player.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$c, 11, 260, 573);
    			add_location(br5, file$c, 12, 1, 637);
    			add_location(br6, file$c, 12, 5, 641);
    			add_location(br7, file$c, 12, 9, 645);
    			add_location(br8, file$c, 12, 13, 649);
    			add_location(br9, file$c, 12, 17, 653);
    			add_location(br10, file$c, 12, 21, 657);
    			add_location(br11, file$c, 12, 25, 661);
    			add_location(br12, file$c, 12, 29, 665);
    			attr_dev(div1, "class", "backgroundcolor svelte-1r4jk2k");
    			add_location(div1, file$c, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, br0);
    			append_dev(div1, br1);
    			append_dev(div1, t0);
    			append_dev(div1, img0);
    			append_dev(div1, br2);
    			append_dev(div1, t1);
    			append_dev(div1, img1);
    			append_dev(div1, br3);
    			append_dev(div1, t2);
    			append_dev(div1, img2);
    			append_dev(div1, br4);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    			append_dev(div1, script);
    			append_dev(div1, t4);
    			append_dev(div1, br5);
    			append_dev(div1, br6);
    			append_dev(div1, br7);
    			append_dev(div1, br8);
    			append_dev(div1, br9);
    			append_dev(div1, br10);
    			append_dev(div1, br11);
    			append_dev(div1, br12);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Corrupted> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Corrupted", $$slots, []);
    	return [];
    }

    class Corrupted extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Corrupted",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* src/specifics/OilBuddies.svelte generated by Svelte v3.23.0 */

    const file$d = "src/specifics/OilBuddies.svelte";

    function create_fragment$d(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let iframe;
    	let iframe_src_value;
    	let script;
    	let script_src_value;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			iframe = element("iframe");
    			script = element("script");
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/331605956?autoplay=1&loop=1&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			set_style(iframe, "position", "absolute");
    			set_style(iframe, "top", "0");
    			set_style(iframe, "left", "0");
    			set_style(iframe, "width", "100%");
    			set_style(iframe, "height", "100%");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$d, 7, 58, 201);
    			set_style(div0, "padding", "56.25% 0 0 0");
    			set_style(div0, "position", "relative");
    			add_location(div0, file$d, 7, 5, 148);
    			if (script.src !== (script_src_value = "https://player.vimeo.com/api/player.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$d, 7, 298, 441);
    			set_style(div1, "position", "absolute");
    			set_style(div1, "top", "5%");
    			set_style(div1, "left", "5%");
    			set_style(div1, "right", "5%");
    			set_style(div1, "width", "90%");
    			set_style(div1, "height", "90%");
    			add_location(div1, file$d, 6, 1, 54);
    			attr_dev(div2, "class", "backgroundcolor svelte-1bmraz4");
    			add_location(div2, file$d, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    			append_dev(div1, script);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<OilBuddies> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("OilBuddies", $$slots, []);
    	return [];
    }

    class OilBuddies extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "OilBuddies",
    			options,
    			id: create_fragment$d.name
    		});
    	}
    }

    /* src/specifics/Litabok.svelte generated by Svelte v3.23.0 */

    const file$e = "src/specifics/Litabok.svelte";

    function create_fragment$e(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let t6;
    	let img5;
    	let img5_src_value;
    	let br11;
    	let t7;
    	let img6;
    	let img6_src_value;
    	let t8;
    	let img7;
    	let img7_src_value;
    	let t9;
    	let img8;
    	let img8_src_value;
    	let t10;
    	let img9;
    	let img9_src_value;
    	let t11;
    	let img10;
    	let img10_src_value;
    	let t12;
    	let img11;
    	let img11_src_value;
    	let t13;
    	let img12;
    	let img12_src_value;
    	let t14;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let br18;
    	let br19;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			t6 = space();
    			img5 = element("img");
    			br11 = element("br");
    			t7 = space();
    			img6 = element("img");
    			t8 = space();
    			img7 = element("img");
    			t9 = space();
    			img8 = element("img");
    			t10 = space();
    			img9 = element("img");
    			t11 = space();
    			img10 = element("img");
    			t12 = space();
    			img11 = element("img");
    			t13 = space();
    			img12 = element("img");
    			t14 = space();
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			add_location(br0, file$e, 6, 1, 54);
    			add_location(br1, file$e, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-1kpd0oy");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/litabok/15.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$e, 7, 1, 64);
    			add_location(br2, file$e, 7, 72, 135);
    			attr_dev(img1, "class", "img portfolio-item smaller svelte-1kpd0oy");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/litabok/14.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$e, 8, 1, 141);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-1kpd0oy");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/litabok/13.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$e, 9, 1, 222);
    			attr_dev(img3, "class", "img portfolio-item smaller svelte-1kpd0oy");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/litabok/12.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$e, 10, 1, 303);
    			attr_dev(img4, "class", "img portfolio-item smaller svelte-1kpd0oy");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/litabok/2.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$e, 20, 1, 1118);
    			add_location(br3, file$e, 22, 1, 1285);
    			add_location(br4, file$e, 22, 5, 1289);
    			add_location(br5, file$e, 22, 9, 1293);
    			add_location(br6, file$e, 22, 13, 1297);
    			add_location(br7, file$e, 22, 17, 1301);
    			add_location(br8, file$e, 22, 21, 1305);
    			add_location(br9, file$e, 22, 25, 1309);
    			add_location(br10, file$e, 22, 29, 1313);
    			attr_dev(img5, "class", "img portfolio-item svelte-1kpd0oy");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/litabok/3.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$e, 23, 1, 1319);
    			add_location(br11, file$e, 23, 71, 1389);
    			attr_dev(img6, "class", "img portfolio-item svelte-1kpd0oy");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/litabok/2.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$e, 24, 1, 1395);
    			attr_dev(img7, "class", "img portfolio-item svelte-1kpd0oy");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/litabok/1.jpg")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$e, 25, 1, 1467);
    			attr_dev(img8, "class", "img portfolio-item svelte-1kpd0oy");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/litabok/0.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$e, 26, 1, 1539);
    			attr_dev(img9, "class", "img portfolio-item fixedsmallpic fourth-fixedsmallpic svelte-1kpd0oy");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/litabok/skulpt25-small.png")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$e, 29, 1, 1613);
    			attr_dev(img10, "class", "img portfolio-item fixedsmallpic first-fixedsmallpic svelte-1kpd0oy");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/litabok/skulpt5-small-skuggi.png")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$e, 30, 1, 1733);
    			attr_dev(img11, "class", "img portfolio-item fixedsmallpic third-fixedsmallpic svelte-1kpd0oy");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/litabok/skulpt8-small.png")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$e, 31, 1, 1858);
    			attr_dev(img12, "class", "img portfolio-item fixedsmallpic second-fixedsmallpic svelte-1kpd0oy");
    			attr_dev(img12, "alt", "mynd");
    			if (img12.src !== (img12_src_value = "igms/litabok/skulpt6-small.png")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$e, 32, 1, 1976);
    			add_location(br12, file$e, 39, 1, 2104);
    			add_location(br13, file$e, 39, 5, 2108);
    			add_location(br14, file$e, 39, 9, 2112);
    			add_location(br15, file$e, 39, 13, 2116);
    			add_location(br16, file$e, 39, 17, 2120);
    			add_location(br17, file$e, 39, 21, 2124);
    			add_location(br18, file$e, 39, 25, 2128);
    			add_location(br19, file$e, 39, 29, 2132);
    			attr_dev(div, "class", "backgroundcolor svelte-1kpd0oy");
    			add_location(div, file$e, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, t6);
    			append_dev(div, img5);
    			append_dev(div, br11);
    			append_dev(div, t7);
    			append_dev(div, img6);
    			append_dev(div, t8);
    			append_dev(div, img7);
    			append_dev(div, t9);
    			append_dev(div, img8);
    			append_dev(div, t10);
    			append_dev(div, img9);
    			append_dev(div, t11);
    			append_dev(div, img10);
    			append_dev(div, t12);
    			append_dev(div, img11);
    			append_dev(div, t13);
    			append_dev(div, img12);
    			append_dev(div, t14);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, br18);
    			append_dev(div, br19);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Litabok> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Litabok", $$slots, []);
    	return [];
    }

    class Litabok extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Litabok",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    /* src/specifics/Plastica.svelte generated by Svelte v3.23.0 */

    const file$f = "src/specifics/Plastica.svelte";

    function create_fragment$f(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			img5 = element("img");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			add_location(br0, file$f, 6, 1, 54);
    			add_location(br1, file$f, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-kjrpwt");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/plastica/1.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$f, 7, 1, 64);
    			add_location(br2, file$f, 7, 72, 135);
    			attr_dev(img1, "class", "img portfolio-item smaller svelte-kjrpwt");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/plastica/2.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$f, 8, 1, 141);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-kjrpwt");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/plastica/3.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$f, 9, 1, 222);
    			attr_dev(img3, "class", "img portfolio-item smaller svelte-kjrpwt");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/plastica/5.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$f, 10, 1, 303);
    			attr_dev(img4, "class", "img portfolio-item smaller svelte-kjrpwt");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/plastica/4.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$f, 11, 1, 384);
    			attr_dev(img5, "class", "img portfolio-item smaller svelte-kjrpwt");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/plastica/6.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$f, 12, 1, 465);
    			attr_dev(img6, "class", "img portfolio-item svelte-kjrpwt");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/plastica/8.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$f, 14, 1, 626);
    			add_location(br3, file$f, 15, 1, 699);
    			add_location(br4, file$f, 15, 5, 703);
    			add_location(br5, file$f, 15, 9, 707);
    			add_location(br6, file$f, 15, 13, 711);
    			add_location(br7, file$f, 15, 17, 715);
    			add_location(br8, file$f, 15, 21, 719);
    			add_location(br9, file$f, 15, 25, 723);
    			add_location(br10, file$f, 15, 29, 727);
    			attr_dev(div, "class", "backgroundcolor svelte-kjrpwt");
    			add_location(div, file$f, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Plastica> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Plastica", $$slots, []);
    	return [];
    }

    class Plastica extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Plastica",
    			options,
    			id: create_fragment$f.name
    		});
    	}
    }

    /* src/specifics/FamiliarFaces.svelte generated by Svelte v3.23.0 */

    const file$g = "src/specifics/FamiliarFaces.svelte";

    function create_fragment$g(ctx) {
    	let div1;
    	let br0;
    	let br1;
    	let t0;
    	let div0;
    	let iframe;
    	let iframe_src_value;
    	let script;
    	let script_src_value;
    	let t1;
    	let img0;
    	let img0_src_value;
    	let t2;
    	let img1;
    	let img1_src_value;
    	let t3;
    	let img2;
    	let img2_src_value;
    	let t4;
    	let img3;
    	let img3_src_value;
    	let t5;
    	let img4;
    	let img4_src_value;
    	let t6;
    	let img5;
    	let img5_src_value;
    	let t7;
    	let img6;
    	let img6_src_value;
    	let t8;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			div0 = element("div");
    			iframe = element("iframe");
    			script = element("script");
    			t1 = space();
    			img0 = element("img");
    			t2 = space();
    			img1 = element("img");
    			t3 = space();
    			img2 = element("img");
    			t4 = space();
    			img3 = element("img");
    			t5 = space();
    			img4 = element("img");
    			t6 = space();
    			img5 = element("img");
    			t7 = space();
    			img6 = element("img");
    			t8 = space();
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			add_location(br0, file$g, 6, 1, 54);
    			add_location(br1, file$g, 6, 5, 58);
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/324752891?autoplay=1&loop=1&color=ffffff&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "class", "moving-vid svelte-1muytiu");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$g, 7, 24, 87);
    			attr_dev(div0, "class", "vid-kassi svelte-1muytiu");
    			add_location(div0, file$g, 7, 1, 64);
    			if (script.src !== (script_src_value = "https://player.vimeo.com/api/player.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$g, 7, 233, 296);
    			attr_dev(img0, "class", "img portfolio-item svelte-1muytiu");
    			set_style(img0, "height", "80%");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/familiarfaces/1.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$g, 8, 1, 360);
    			attr_dev(img1, "class", "img portfolio-item svelte-1muytiu");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/familiarfaces/2.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$g, 9, 1, 459);
    			attr_dev(img2, "class", "img portfolio-item svelte-1muytiu");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/familiarfaces/3.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$g, 10, 1, 537);
    			attr_dev(img3, "class", "img portfolio-item svelte-1muytiu");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/familiarfaces/4.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$g, 11, 1, 615);
    			attr_dev(img4, "class", "img portfolio-item svelte-1muytiu");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/familiarfaces/5.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$g, 12, 1, 693);
    			attr_dev(img5, "class", "img portfolio-item svelte-1muytiu");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/familiarfaces/6.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$g, 13, 1, 771);
    			attr_dev(img6, "class", "img portfolio-item svelte-1muytiu");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/familiarfaces/7.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$g, 14, 1, 849);
    			add_location(br2, file$g, 15, 1, 927);
    			add_location(br3, file$g, 15, 5, 931);
    			add_location(br4, file$g, 15, 9, 935);
    			add_location(br5, file$g, 15, 13, 939);
    			add_location(br6, file$g, 15, 17, 943);
    			add_location(br7, file$g, 15, 21, 947);
    			add_location(br8, file$g, 15, 25, 951);
    			add_location(br9, file$g, 15, 29, 955);
    			attr_dev(div1, "class", "backgroundcolor svelte-1muytiu");
    			add_location(div1, file$g, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, br0);
    			append_dev(div1, br1);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    			append_dev(div1, script);
    			append_dev(div1, t1);
    			append_dev(div1, img0);
    			append_dev(div1, t2);
    			append_dev(div1, img1);
    			append_dev(div1, t3);
    			append_dev(div1, img2);
    			append_dev(div1, t4);
    			append_dev(div1, img3);
    			append_dev(div1, t5);
    			append_dev(div1, img4);
    			append_dev(div1, t6);
    			append_dev(div1, img5);
    			append_dev(div1, t7);
    			append_dev(div1, img6);
    			append_dev(div1, t8);
    			append_dev(div1, br2);
    			append_dev(div1, br3);
    			append_dev(div1, br4);
    			append_dev(div1, br5);
    			append_dev(div1, br6);
    			append_dev(div1, br7);
    			append_dev(div1, br8);
    			append_dev(div1, br9);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<FamiliarFaces> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("FamiliarFaces", $$slots, []);
    	return [];
    }

    class FamiliarFaces extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "FamiliarFaces",
    			options,
    			id: create_fragment$g.name
    		});
    	}
    }

    /* src/specifics/Likamar.svelte generated by Svelte v3.23.0 */

    const file$h = "src/specifics/Likamar.svelte";

    function create_fragment$h(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br2;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let br3;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let br4;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let t7;
    	let img7;
    	let img7_src_value;
    	let t8;
    	let img8;
    	let img8_src_value;
    	let t9;
    	let img9;
    	let img9_src_value;
    	let t10;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let br11;
    	let br12;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			br2 = element("br");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			br3 = element("br");
    			t5 = space();
    			img5 = element("img");
    			br4 = element("br");
    			t6 = space();
    			img6 = element("img");
    			t7 = space();
    			img7 = element("img");
    			t8 = space();
    			img8 = element("img");
    			t9 = space();
    			img9 = element("img");
    			t10 = space();
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			add_location(br0, file$h, 6, 1, 54);
    			add_location(br1, file$h, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item tiny svelte-1fvzsuk");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/typedesign/likamartestpink.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$h, 7, 1, 64);
    			attr_dev(img1, "class", "img portfolio-item svelte-1fvzsuk");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/typedesign/apri2.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$h, 10, 1, 160);
    			add_location(br2, file$h, 10, 78, 237);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-1fvzsuk");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/typedesign/blatt.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$h, 12, 1, 245);
    			attr_dev(img3, "class", "img portfolio-item smaller svelte-1fvzsuk");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/typedesign/dokkt.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$h, 13, 1, 332);
    			attr_dev(img4, "class", "img portfolio-item smaller svelte-1fvzsuk");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/typedesign/orange.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$h, 14, 1, 419);
    			add_location(br3, file$h, 14, 87, 505);
    			attr_dev(img5, "class", "img portfolio-item larger svelte-1fvzsuk");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/typedesign/building.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$h, 15, 1, 511);
    			add_location(br4, file$h, 15, 88, 598);
    			attr_dev(img6, "class", "img portfolio-item smaller-two svelte-1fvzsuk");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/typedesign/motionMobile.gif")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$h, 17, 1, 605);
    			attr_dev(img7, "class", "img portfolio-item smaller-two  svelte-1fvzsuk");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/typedesign/motionMobileCgaedi.gif")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$h, 18, 1, 703);
    			attr_dev(img8, "class", "img portfolio-item smaller-two svelte-1fvzsuk");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/typedesign/svhv27b.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$h, 19, 1, 808);
    			attr_dev(img9, "class", "img portfolio-item smaller-two svelte-1fvzsuk");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/typedesign/svhv35b.jpg")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$h, 20, 1, 901);
    			add_location(br5, file$h, 22, 1, 996);
    			add_location(br6, file$h, 22, 5, 1000);
    			add_location(br7, file$h, 22, 9, 1004);
    			add_location(br8, file$h, 22, 13, 1008);
    			add_location(br9, file$h, 22, 17, 1012);
    			add_location(br10, file$h, 22, 21, 1016);
    			add_location(br11, file$h, 22, 25, 1020);
    			add_location(br12, file$h, 22, 29, 1024);
    			attr_dev(div, "class", "backgroundcolor svelte-1fvzsuk");
    			add_location(div, file$h, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, br3);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, br4);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, t7);
    			append_dev(div, img7);
    			append_dev(div, t8);
    			append_dev(div, img8);
    			append_dev(div, t9);
    			append_dev(div, img9);
    			append_dev(div, t10);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Likamar> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Likamar", $$slots, []);
    	return [];
    }

    class Likamar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Likamar",
    			options,
    			id: create_fragment$h.name
    		});
    	}
    }

    /* src/specifics/Oeb.svelte generated by Svelte v3.23.0 */

    const file$i = "src/specifics/Oeb.svelte";

    function create_fragment$i(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br10;
    	let br11;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let br18;
    	let br19;
    	let br20;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let br25;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let br26;
    	let br27;
    	let br28;
    	let br29;
    	let br30;
    	let br31;
    	let br32;
    	let br33;
    	let t5;
    	let img4;
    	let img4_src_value;
    	let br34;
    	let t6;
    	let img5;
    	let img5_src_value;
    	let t7;
    	let img6;
    	let img6_src_value;
    	let t8;
    	let img7;
    	let img7_src_value;
    	let t9;
    	let img8;
    	let img8_src_value;
    	let br35;
    	let br36;
    	let br37;
    	let br38;
    	let br39;
    	let br40;
    	let br41;
    	let br42;
    	let t10;
    	let img9;
    	let img9_src_value;
    	let t11;
    	let br43;
    	let br44;
    	let br45;
    	let br46;
    	let br47;
    	let br48;
    	let br49;
    	let br50;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			t1 = space();
    			img1 = element("img");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			t2 = space();
    			img2 = element("img");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			br25 = element("br");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			br29 = element("br");
    			br30 = element("br");
    			br31 = element("br");
    			br32 = element("br");
    			br33 = element("br");
    			t5 = space();
    			img4 = element("img");
    			br34 = element("br");
    			t6 = space();
    			img5 = element("img");
    			t7 = space();
    			img6 = element("img");
    			t8 = space();
    			img7 = element("img");
    			t9 = space();
    			img8 = element("img");
    			br35 = element("br");
    			br36 = element("br");
    			br37 = element("br");
    			br38 = element("br");
    			br39 = element("br");
    			br40 = element("br");
    			br41 = element("br");
    			br42 = element("br");
    			t10 = space();
    			img9 = element("img");
    			t11 = space();
    			br43 = element("br");
    			br44 = element("br");
    			br45 = element("br");
    			br46 = element("br");
    			br47 = element("br");
    			br48 = element("br");
    			br49 = element("br");
    			br50 = element("br");
    			add_location(br0, file$i, 6, 1, 54);
    			add_location(br1, file$i, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item larger svelte-13vy55a");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/oeb/screena.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$i, 7, 1, 64);
    			add_location(br2, file$i, 7, 80, 143);
    			add_location(br3, file$i, 7, 84, 147);
    			add_location(br4, file$i, 7, 88, 151);
    			add_location(br5, file$i, 7, 92, 155);
    			add_location(br6, file$i, 7, 96, 159);
    			add_location(br7, file$i, 7, 100, 163);
    			add_location(br8, file$i, 7, 104, 167);
    			add_location(br9, file$i, 7, 108, 171);
    			attr_dev(img1, "class", "img portfolio-item larger svelte-13vy55a");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/oeb/screenb.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$i, 8, 1, 177);
    			add_location(br10, file$i, 8, 80, 256);
    			add_location(br11, file$i, 8, 84, 260);
    			add_location(br12, file$i, 8, 88, 264);
    			add_location(br13, file$i, 8, 92, 268);
    			add_location(br14, file$i, 8, 96, 272);
    			add_location(br15, file$i, 8, 100, 276);
    			add_location(br16, file$i, 8, 104, 280);
    			add_location(br17, file$i, 8, 108, 284);
    			attr_dev(img2, "class", "img portfolio-item larger svelte-13vy55a");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/oeb/screenc.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$i, 9, 1, 290);
    			add_location(br18, file$i, 9, 80, 369);
    			add_location(br19, file$i, 9, 84, 373);
    			add_location(br20, file$i, 9, 88, 377);
    			add_location(br21, file$i, 9, 92, 381);
    			add_location(br22, file$i, 9, 96, 385);
    			add_location(br23, file$i, 9, 100, 389);
    			add_location(br24, file$i, 9, 104, 393);
    			add_location(br25, file$i, 9, 108, 397);
    			attr_dev(img3, "class", "img portfolio-item larger svelte-13vy55a");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/oeb/screend.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$i, 10, 1, 403);
    			add_location(br26, file$i, 11, 1, 484);
    			add_location(br27, file$i, 11, 5, 488);
    			add_location(br28, file$i, 11, 9, 492);
    			add_location(br29, file$i, 11, 13, 496);
    			add_location(br30, file$i, 11, 17, 500);
    			add_location(br31, file$i, 11, 21, 504);
    			add_location(br32, file$i, 11, 25, 508);
    			add_location(br33, file$i, 11, 29, 512);
    			attr_dev(img4, "class", "img portfolio-item attatiuvidd svelte-13vy55a");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/oeb/h.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$i, 12, 1, 518);
    			add_location(br34, file$i, 12, 79, 596);
    			attr_dev(img5, "class", "img portfolio-item attatiuvidd svelte-13vy55a");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/oeb/0a.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$i, 13, 1, 602);
    			attr_dev(img6, "class", "img portfolio-item svelte-13vy55a");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/oeb/1b.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$i, 14, 1, 683);
    			attr_dev(img7, "class", "img portfolio-item svelte-13vy55a");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/oeb/5.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$i, 15, 1, 752);
    			attr_dev(img8, "class", "img portfolio-item svelte-13vy55a");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/oeb/yout_Page_25.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$i, 18, 1, 824);
    			add_location(br35, file$i, 18, 78, 901);
    			add_location(br36, file$i, 18, 82, 905);
    			add_location(br37, file$i, 18, 86, 909);
    			add_location(br38, file$i, 18, 90, 913);
    			add_location(br39, file$i, 18, 94, 917);
    			add_location(br40, file$i, 18, 98, 921);
    			add_location(br41, file$i, 18, 102, 925);
    			add_location(br42, file$i, 18, 106, 929);
    			attr_dev(img9, "class", "img portfolio-item svelte-13vy55a");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/oeb/yout_Page_20.jpg")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$i, 19, 1, 935);
    			add_location(br43, file$i, 28, 1, 1399);
    			add_location(br44, file$i, 28, 5, 1403);
    			add_location(br45, file$i, 28, 9, 1407);
    			add_location(br46, file$i, 28, 13, 1411);
    			add_location(br47, file$i, 28, 17, 1415);
    			add_location(br48, file$i, 28, 21, 1419);
    			add_location(br49, file$i, 28, 25, 1423);
    			add_location(br50, file$i, 28, 29, 1427);
    			attr_dev(div, "class", "backgroundcolor svelte-13vy55a");
    			add_location(div, file$i, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, br18);
    			append_dev(div, br19);
    			append_dev(div, br20);
    			append_dev(div, br21);
    			append_dev(div, br22);
    			append_dev(div, br23);
    			append_dev(div, br24);
    			append_dev(div, br25);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, br26);
    			append_dev(div, br27);
    			append_dev(div, br28);
    			append_dev(div, br29);
    			append_dev(div, br30);
    			append_dev(div, br31);
    			append_dev(div, br32);
    			append_dev(div, br33);
    			append_dev(div, t5);
    			append_dev(div, img4);
    			append_dev(div, br34);
    			append_dev(div, t6);
    			append_dev(div, img5);
    			append_dev(div, t7);
    			append_dev(div, img6);
    			append_dev(div, t8);
    			append_dev(div, img7);
    			append_dev(div, t9);
    			append_dev(div, img8);
    			append_dev(div, br35);
    			append_dev(div, br36);
    			append_dev(div, br37);
    			append_dev(div, br38);
    			append_dev(div, br39);
    			append_dev(div, br40);
    			append_dev(div, br41);
    			append_dev(div, br42);
    			append_dev(div, t10);
    			append_dev(div, img9);
    			append_dev(div, t11);
    			append_dev(div, br43);
    			append_dev(div, br44);
    			append_dev(div, br45);
    			append_dev(div, br46);
    			append_dev(div, br47);
    			append_dev(div, br48);
    			append_dev(div, br49);
    			append_dev(div, br50);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Oeb> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Oeb", $$slots, []);
    	return [];
    }

    class Oeb extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Oeb",
    			options,
    			id: create_fragment$i.name
    		});
    	}
    }

    /* src/specifics/beauimg.svelte generated by Svelte v3.23.0 */

    const file$j = "src/specifics/beauimg.svelte";

    function create_fragment$j(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let t2;
    	let img1;
    	let img1_src_value;
    	let t3;
    	let img2;
    	let img2_src_value;
    	let br6;
    	let t4;
    	let img3;
    	let img3_src_value;
    	let br7;
    	let t5;
    	let img4;
    	let img4_src_value;
    	let t6;
    	let img5;
    	let img5_src_value;
    	let t7;
    	let img6;
    	let img6_src_value;
    	let br8;
    	let t8;
    	let img7;
    	let img7_src_value;
    	let t9;
    	let img8;
    	let img8_src_value;
    	let t10;
    	let img9;
    	let img9_src_value;
    	let t11;
    	let img10;
    	let img10_src_value;
    	let t12;
    	let img11;
    	let img11_src_value;
    	let br9;
    	let t13;
    	let img12;
    	let img12_src_value;
    	let t14;
    	let img13;
    	let img13_src_value;
    	let t15;
    	let br10;
    	let br11;
    	let br12;
    	let br13;
    	let t16;
    	let img14;
    	let img14_src_value;
    	let t17;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let t18;
    	let img15;
    	let img15_src_value;
    	let br18;
    	let t19;
    	let img16;
    	let img16_src_value;
    	let t20;
    	let img17;
    	let img17_src_value;
    	let t21;
    	let img18;
    	let img18_src_value;
    	let br19;
    	let t22;
    	let img19;
    	let img19_src_value;
    	let br20;
    	let t23;
    	let img20;
    	let img20_src_value;
    	let t24;
    	let img21;
    	let img21_src_value;
    	let t25;
    	let img22;
    	let img22_src_value;
    	let t26;
    	let img23;
    	let img23_src_value;
    	let t27;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let t28;
    	let img24;
    	let img24_src_value;
    	let t29;
    	let img25;
    	let img25_src_value;
    	let t30;
    	let img26;
    	let img26_src_value;
    	let t31;
    	let img27;
    	let img27_src_value;
    	let t32;
    	let br25;
    	let br26;
    	let br27;
    	let br28;
    	let t33;
    	let img28;
    	let img28_src_value;
    	let t34;
    	let br29;
    	let br30;
    	let br31;
    	let br32;
    	let br33;
    	let br34;
    	let br35;
    	let br36;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			t2 = space();
    			img1 = element("img");
    			t3 = space();
    			img2 = element("img");
    			br6 = element("br");
    			t4 = space();
    			img3 = element("img");
    			br7 = element("br");
    			t5 = space();
    			img4 = element("img");
    			t6 = space();
    			img5 = element("img");
    			t7 = space();
    			img6 = element("img");
    			br8 = element("br");
    			t8 = space();
    			img7 = element("img");
    			t9 = space();
    			img8 = element("img");
    			t10 = space();
    			img9 = element("img");
    			t11 = space();
    			img10 = element("img");
    			t12 = space();
    			img11 = element("img");
    			br9 = element("br");
    			t13 = space();
    			img12 = element("img");
    			t14 = space();
    			img13 = element("img");
    			t15 = space();
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			t16 = space();
    			img14 = element("img");
    			t17 = space();
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			t18 = space();
    			img15 = element("img");
    			br18 = element("br");
    			t19 = space();
    			img16 = element("img");
    			t20 = space();
    			img17 = element("img");
    			t21 = space();
    			img18 = element("img");
    			br19 = element("br");
    			t22 = space();
    			img19 = element("img");
    			br20 = element("br");
    			t23 = space();
    			img20 = element("img");
    			t24 = space();
    			img21 = element("img");
    			t25 = space();
    			img22 = element("img");
    			t26 = space();
    			img23 = element("img");
    			t27 = space();
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			t28 = space();
    			img24 = element("img");
    			t29 = space();
    			img25 = element("img");
    			t30 = space();
    			img26 = element("img");
    			t31 = space();
    			img27 = element("img");
    			t32 = space();
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			t33 = space();
    			img28 = element("img");
    			t34 = space();
    			br29 = element("br");
    			br30 = element("br");
    			br31 = element("br");
    			br32 = element("br");
    			br33 = element("br");
    			br34 = element("br");
    			br35 = element("br");
    			br36 = element("br");
    			add_location(br0, file$j, 6, 1, 54);
    			add_location(br1, file$j, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/beauimg/main.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$j, 7, 1, 64);
    			add_location(br2, file$j, 8, 1, 139);
    			add_location(br3, file$j, 8, 5, 143);
    			add_location(br4, file$j, 8, 9, 147);
    			add_location(br5, file$j, 8, 13, 151);
    			attr_dev(img1, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/beauimg/0.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$j, 9, 1, 157);
    			attr_dev(img2, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/beauimg/1.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$j, 10, 1, 229);
    			add_location(br6, file$j, 10, 71, 299);
    			attr_dev(img3, "class", "img portfolio-item larger svelte-vg5c57");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/beauimg/auka1b.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$j, 11, 1, 305);
    			add_location(br7, file$j, 11, 83, 387);
    			attr_dev(img4, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/beauimg/2.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$j, 12, 1, 393);
    			attr_dev(img5, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/beauimg/3.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$j, 13, 1, 465);
    			attr_dev(img6, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/beauimg/4.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$j, 14, 1, 537);
    			add_location(br8, file$j, 14, 71, 607);
    			attr_dev(img7, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/beauimg/5.jpg")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$j, 15, 1, 613);
    			attr_dev(img8, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/beauimg/6.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$j, 16, 1, 685);
    			attr_dev(img9, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/beauimg/9.jpg")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$j, 19, 1, 908);
    			attr_dev(img10, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/beauimg/10.jpg")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$j, 20, 1, 980);
    			attr_dev(img11, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/beauimg/11.jpg")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$j, 21, 1, 1053);
    			add_location(br9, file$j, 21, 72, 1124);
    			attr_dev(img12, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img12, "alt", "mynd");
    			if (img12.src !== (img12_src_value = "igms/beauimg/12.jpg")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$j, 22, 1, 1130);
    			attr_dev(img13, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img13, "alt", "mynd");
    			if (img13.src !== (img13_src_value = "igms/beauimg/13.jpg")) attr_dev(img13, "src", img13_src_value);
    			add_location(img13, file$j, 23, 1, 1203);
    			add_location(br10, file$j, 24, 1, 1276);
    			add_location(br11, file$j, 24, 5, 1280);
    			add_location(br12, file$j, 24, 9, 1284);
    			add_location(br13, file$j, 24, 13, 1288);
    			attr_dev(img14, "class", "img portfolio-item larger svelte-vg5c57");
    			attr_dev(img14, "alt", "mynd");
    			if (img14.src !== (img14_src_value = "igms/beauimg/blubbsmallerbutnotsmallenough.png")) attr_dev(img14, "src", img14_src_value);
    			add_location(img14, file$j, 25, 1, 1294);
    			add_location(br14, file$j, 26, 1, 1401);
    			add_location(br15, file$j, 26, 5, 1405);
    			add_location(br16, file$j, 26, 9, 1409);
    			add_location(br17, file$j, 26, 13, 1413);
    			attr_dev(img15, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img15, "alt", "mynd");
    			if (img15.src !== (img15_src_value = "igms/beauimg/14.jpg")) attr_dev(img15, "src", img15_src_value);
    			add_location(img15, file$j, 27, 1, 1419);
    			add_location(br18, file$j, 27, 72, 1490);
    			attr_dev(img16, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img16, "alt", "mynd");
    			if (img16.src !== (img16_src_value = "igms/beauimg/15.jpg")) attr_dev(img16, "src", img16_src_value);
    			add_location(img16, file$j, 28, 1, 1496);
    			attr_dev(img17, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img17, "alt", "mynd");
    			if (img17.src !== (img17_src_value = "igms/beauimg/16.jpg")) attr_dev(img17, "src", img17_src_value);
    			add_location(img17, file$j, 29, 1, 1569);
    			attr_dev(img18, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img18, "alt", "mynd");
    			if (img18.src !== (img18_src_value = "igms/beauimg/17.jpg")) attr_dev(img18, "src", img18_src_value);
    			add_location(img18, file$j, 30, 1, 1642);
    			add_location(br19, file$j, 30, 72, 1713);
    			attr_dev(img19, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img19, "alt", "mynd");
    			if (img19.src !== (img19_src_value = "igms/beauimg/21.jpg")) attr_dev(img19, "src", img19_src_value);
    			add_location(img19, file$j, 32, 1, 1720);
    			add_location(br20, file$j, 32, 72, 1791);
    			attr_dev(img20, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img20, "alt", "mynd");
    			if (img20.src !== (img20_src_value = "igms/beauimg/22.jpg")) attr_dev(img20, "src", img20_src_value);
    			add_location(img20, file$j, 33, 1, 1797);
    			attr_dev(img21, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img21, "alt", "mynd");
    			if (img21.src !== (img21_src_value = "igms/beauimg/23.jpg")) attr_dev(img21, "src", img21_src_value);
    			add_location(img21, file$j, 34, 1, 1870);
    			attr_dev(img22, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img22, "alt", "mynd");
    			if (img22.src !== (img22_src_value = "igms/beauimg/24.jpg")) attr_dev(img22, "src", img22_src_value);
    			add_location(img22, file$j, 35, 1, 1943);
    			attr_dev(img23, "class", "img portfolio-item svelte-vg5c57");
    			attr_dev(img23, "alt", "mynd");
    			if (img23.src !== (img23_src_value = "igms/beauimg/aukaauka2.jpg")) attr_dev(img23, "src", img23_src_value);
    			add_location(img23, file$j, 36, 1, 2016);
    			add_location(br21, file$j, 38, 1, 2177);
    			add_location(br22, file$j, 38, 5, 2181);
    			add_location(br23, file$j, 38, 9, 2185);
    			add_location(br24, file$j, 38, 13, 2189);
    			attr_dev(img24, "class", "img portfolio-item smaller svelte-vg5c57");
    			attr_dev(img24, "alt", "mynd");
    			if (img24.src !== (img24_src_value = "igms/beauimg/aukaa2.jpg")) attr_dev(img24, "src", img24_src_value);
    			add_location(img24, file$j, 39, 1, 2195);
    			attr_dev(img25, "class", "img portfolio-item smaller svelte-vg5c57");
    			attr_dev(img25, "alt", "mynd");
    			if (img25.src !== (img25_src_value = "igms/beauimg/aukab2.jpg")) attr_dev(img25, "src", img25_src_value);
    			add_location(img25, file$j, 40, 1, 2280);
    			attr_dev(img26, "class", "img portfolio-item smaller svelte-vg5c57");
    			attr_dev(img26, "alt", "mynd");
    			if (img26.src !== (img26_src_value = "igms/beauimg/aukac2.jpg")) attr_dev(img26, "src", img26_src_value);
    			add_location(img26, file$j, 41, 1, 2365);
    			attr_dev(img27, "class", "img portfolio-item smaller svelte-vg5c57");
    			attr_dev(img27, "alt", "mynd");
    			if (img27.src !== (img27_src_value = "igms/beauimg/aukad2.jpg")) attr_dev(img27, "src", img27_src_value);
    			add_location(img27, file$j, 42, 1, 2450);
    			add_location(br25, file$j, 43, 1, 2535);
    			add_location(br26, file$j, 43, 5, 2539);
    			add_location(br27, file$j, 43, 9, 2543);
    			add_location(br28, file$j, 43, 13, 2547);
    			attr_dev(img28, "class", "img portfolio-item larger svelte-vg5c57");
    			attr_dev(img28, "alt", "mynd");
    			if (img28.src !== (img28_src_value = "igms/beauimg/aukaaukaauka.jpg")) attr_dev(img28, "src", img28_src_value);
    			add_location(img28, file$j, 44, 1, 2553);
    			add_location(br29, file$j, 47, 1, 2765);
    			add_location(br30, file$j, 47, 5, 2769);
    			add_location(br31, file$j, 47, 9, 2773);
    			add_location(br32, file$j, 47, 13, 2777);
    			add_location(br33, file$j, 47, 17, 2781);
    			add_location(br34, file$j, 47, 21, 2785);
    			add_location(br35, file$j, 47, 25, 2789);
    			add_location(br36, file$j, 47, 29, 2793);
    			attr_dev(div, "class", "backgroundcolor svelte-vg5c57");
    			add_location(div, file$j, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, br2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, t2);
    			append_dev(div, img1);
    			append_dev(div, t3);
    			append_dev(div, img2);
    			append_dev(div, br6);
    			append_dev(div, t4);
    			append_dev(div, img3);
    			append_dev(div, br7);
    			append_dev(div, t5);
    			append_dev(div, img4);
    			append_dev(div, t6);
    			append_dev(div, img5);
    			append_dev(div, t7);
    			append_dev(div, img6);
    			append_dev(div, br8);
    			append_dev(div, t8);
    			append_dev(div, img7);
    			append_dev(div, t9);
    			append_dev(div, img8);
    			append_dev(div, t10);
    			append_dev(div, img9);
    			append_dev(div, t11);
    			append_dev(div, img10);
    			append_dev(div, t12);
    			append_dev(div, img11);
    			append_dev(div, br9);
    			append_dev(div, t13);
    			append_dev(div, img12);
    			append_dev(div, t14);
    			append_dev(div, img13);
    			append_dev(div, t15);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, t16);
    			append_dev(div, img14);
    			append_dev(div, t17);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, t18);
    			append_dev(div, img15);
    			append_dev(div, br18);
    			append_dev(div, t19);
    			append_dev(div, img16);
    			append_dev(div, t20);
    			append_dev(div, img17);
    			append_dev(div, t21);
    			append_dev(div, img18);
    			append_dev(div, br19);
    			append_dev(div, t22);
    			append_dev(div, img19);
    			append_dev(div, br20);
    			append_dev(div, t23);
    			append_dev(div, img20);
    			append_dev(div, t24);
    			append_dev(div, img21);
    			append_dev(div, t25);
    			append_dev(div, img22);
    			append_dev(div, t26);
    			append_dev(div, img23);
    			append_dev(div, t27);
    			append_dev(div, br21);
    			append_dev(div, br22);
    			append_dev(div, br23);
    			append_dev(div, br24);
    			append_dev(div, t28);
    			append_dev(div, img24);
    			append_dev(div, t29);
    			append_dev(div, img25);
    			append_dev(div, t30);
    			append_dev(div, img26);
    			append_dev(div, t31);
    			append_dev(div, img27);
    			append_dev(div, t32);
    			append_dev(div, br25);
    			append_dev(div, br26);
    			append_dev(div, br27);
    			append_dev(div, br28);
    			append_dev(div, t33);
    			append_dev(div, img28);
    			append_dev(div, t34);
    			append_dev(div, br29);
    			append_dev(div, br30);
    			append_dev(div, br31);
    			append_dev(div, br32);
    			append_dev(div, br33);
    			append_dev(div, br34);
    			append_dev(div, br35);
    			append_dev(div, br36);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Beauimg> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Beauimg", $$slots, []);
    	return [];
    }

    class Beauimg extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Beauimg",
    			options,
    			id: create_fragment$j.name
    		});
    	}
    }

    /* src/specifics/Bread.svelte generated by Svelte v3.23.0 */

    const file$k = "src/specifics/Bread.svelte";

    function create_fragment$k(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br3;
    	let t2;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let t3;
    	let img2;
    	let img2_src_value;
    	let t4;
    	let img3;
    	let img3_src_value;
    	let br8;
    	let t5;
    	let br9;
    	let br10;
    	let br11;
    	let br12;
    	let t6;
    	let img4;
    	let img4_src_value;
    	let t7;
    	let br13;
    	let t8;
    	let img5;
    	let img5_src_value;
    	let br14;
    	let t9;
    	let img6;
    	let img6_src_value;
    	let br15;
    	let t10;
    	let img7;
    	let img7_src_value;
    	let br16;
    	let t11;
    	let img8;
    	let img8_src_value;
    	let t12;
    	let img9;
    	let img9_src_value;
    	let t13;
    	let br17;
    	let br18;
    	let br19;
    	let br20;
    	let t14;
    	let img10;
    	let img10_src_value;
    	let t15;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let br25;
    	let br26;
    	let br27;
    	let br28;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			br3 = element("br");
    			t2 = space();
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			t3 = space();
    			img2 = element("img");
    			t4 = space();
    			img3 = element("img");
    			br8 = element("br");
    			t5 = space();
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			t6 = space();
    			img4 = element("img");
    			t7 = space();
    			br13 = element("br");
    			t8 = space();
    			img5 = element("img");
    			br14 = element("br");
    			t9 = space();
    			img6 = element("img");
    			br15 = element("br");
    			t10 = space();
    			img7 = element("img");
    			br16 = element("br");
    			t11 = space();
    			img8 = element("img");
    			t12 = space();
    			img9 = element("img");
    			t13 = space();
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			t14 = space();
    			img10 = element("img");
    			t15 = space();
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			add_location(br0, file$k, 6, 1, 54);
    			add_location(br1, file$k, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/bread/first.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$k, 7, 1, 64);
    			add_location(br2, file$k, 7, 73, 136);
    			attr_dev(img1, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/bread/bread-book-table1b.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$k, 8, 1, 142);
    			add_location(br3, file$k, 8, 86, 227);
    			add_location(br4, file$k, 9, 1, 233);
    			add_location(br5, file$k, 9, 5, 237);
    			add_location(br6, file$k, 9, 9, 241);
    			add_location(br7, file$k, 9, 13, 245);
    			attr_dev(img2, "class", "img portfolio-item svelte-1nlb3g3");
    			set_style(img2, "padding-right", "0px");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/bread/bread-book-p2.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$k, 10, 1, 251);
    			attr_dev(img3, "class", "img portfolio-item svelte-1nlb3g3");
    			set_style(img3, "padding-left", "0px");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/bread/bread-book-p1.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$k, 11, 1, 361);
    			add_location(br8, file$k, 11, 108, 468);
    			add_location(br9, file$k, 12, 1, 474);
    			add_location(br10, file$k, 12, 5, 478);
    			add_location(br11, file$k, 12, 9, 482);
    			add_location(br12, file$k, 12, 13, 486);
    			attr_dev(img4, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/bread/bitmap3.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$k, 13, 1, 492);
    			add_location(br13, file$k, 14, 1, 568);
    			attr_dev(img5, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/bread/looking2.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$k, 20, 1, 691);
    			add_location(br14, file$k, 20, 76, 766);
    			attr_dev(img6, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/bread/looking1.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$k, 21, 1, 772);
    			add_location(br15, file$k, 21, 76, 847);
    			attr_dev(img7, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/bread/close2.jpg")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$k, 22, 1, 853);
    			add_location(br16, file$k, 22, 74, 926);
    			attr_dev(img8, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/bread/bottle.jpg")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$k, 23, 1, 932);
    			attr_dev(img9, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/bread/overview.jpg")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$k, 24, 1, 1007);
    			add_location(br17, file$k, 36, 1, 1698);
    			add_location(br18, file$k, 36, 5, 1702);
    			add_location(br19, file$k, 36, 9, 1706);
    			add_location(br20, file$k, 36, 13, 1710);
    			attr_dev(img10, "class", "img portfolio-item svelte-1nlb3g3");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/bread/bread-book-table2.jpg")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$k, 37, 1, 1716);
    			add_location(br21, file$k, 38, 1, 1802);
    			add_location(br22, file$k, 38, 5, 1806);
    			add_location(br23, file$k, 38, 9, 1810);
    			add_location(br24, file$k, 38, 13, 1814);
    			add_location(br25, file$k, 38, 17, 1818);
    			add_location(br26, file$k, 38, 21, 1822);
    			add_location(br27, file$k, 38, 25, 1826);
    			add_location(br28, file$k, 38, 29, 1830);
    			attr_dev(div, "class", "backgroundcolor svelte-1nlb3g3");
    			add_location(div, file$k, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br3);
    			append_dev(div, t2);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, t3);
    			append_dev(div, img2);
    			append_dev(div, t4);
    			append_dev(div, img3);
    			append_dev(div, br8);
    			append_dev(div, t5);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, t6);
    			append_dev(div, img4);
    			append_dev(div, t7);
    			append_dev(div, br13);
    			append_dev(div, t8);
    			append_dev(div, img5);
    			append_dev(div, br14);
    			append_dev(div, t9);
    			append_dev(div, img6);
    			append_dev(div, br15);
    			append_dev(div, t10);
    			append_dev(div, img7);
    			append_dev(div, br16);
    			append_dev(div, t11);
    			append_dev(div, img8);
    			append_dev(div, t12);
    			append_dev(div, img9);
    			append_dev(div, t13);
    			append_dev(div, br17);
    			append_dev(div, br18);
    			append_dev(div, br19);
    			append_dev(div, br20);
    			append_dev(div, t14);
    			append_dev(div, img10);
    			append_dev(div, t15);
    			append_dev(div, br21);
    			append_dev(div, br22);
    			append_dev(div, br23);
    			append_dev(div, br24);
    			append_dev(div, br25);
    			append_dev(div, br26);
    			append_dev(div, br27);
    			append_dev(div, br28);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Bread> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Bread", $$slots, []);
    	return [];
    }

    class Bread extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$k, create_fragment$k, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Bread",
    			options,
    			id: create_fragment$k.name
    		});
    	}
    }

    /* src/specifics/Flora.svelte generated by Svelte v3.23.0 */

    const file$l = "src/specifics/Flora.svelte";

    function create_fragment$l(ctx) {
    	let div1;
    	let br0;
    	let br1;
    	let t0;
    	let div0;
    	let iframe;
    	let iframe_src_value;
    	let script;
    	let script_src_value;
    	let t1;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let t2;
    	let img0;
    	let img0_src_value;
    	let t3;
    	let img1;
    	let img1_src_value;
    	let br10;
    	let t4;
    	let img2;
    	let img2_src_value;
    	let t5;
    	let img3;
    	let img3_src_value;
    	let t6;
    	let img4;
    	let img4_src_value;
    	let t7;
    	let img5;
    	let img5_src_value;
    	let br11;
    	let t8;
    	let img6;
    	let img6_src_value;
    	let t9;
    	let img7;
    	let img7_src_value;
    	let br12;
    	let t10;
    	let img8;
    	let img8_src_value;
    	let t11;
    	let img9;
    	let img9_src_value;
    	let t12;
    	let img10;
    	let img10_src_value;
    	let br13;
    	let t13;
    	let img11;
    	let img11_src_value;
    	let t14;
    	let img12;
    	let img12_src_value;
    	let br14;
    	let t15;
    	let img13;
    	let img13_src_value;
    	let t16;
    	let img14;
    	let img14_src_value;
    	let br15;
    	let t17;
    	let br16;
    	let br17;
    	let br18;
    	let br19;
    	let br20;
    	let br21;
    	let br22;
    	let br23;
    	let t18;
    	let img15;
    	let img15_src_value;
    	let t19;
    	let img16;
    	let img16_src_value;
    	let br24;
    	let t20;
    	let img17;
    	let img17_src_value;
    	let t21;
    	let img18;
    	let img18_src_value;
    	let br25;
    	let t22;
    	let br26;
    	let br27;
    	let br28;
    	let br29;
    	let br30;
    	let br31;
    	let br32;
    	let br33;
    	let t23;
    	let img19;
    	let img19_src_value;
    	let t24;
    	let img20;
    	let img20_src_value;
    	let t25;
    	let br34;
    	let br35;
    	let br36;
    	let br37;
    	let br38;
    	let br39;
    	let br40;
    	let br41;
    	let t26;
    	let img21;
    	let img21_src_value;
    	let br42;
    	let t27;
    	let img22;
    	let img22_src_value;
    	let t28;
    	let img23;
    	let img23_src_value;
    	let t29;
    	let br43;
    	let br44;
    	let br45;
    	let br46;
    	let br47;
    	let br48;
    	let br49;
    	let br50;
    	let t30;
    	let img24;
    	let img24_src_value;
    	let br51;
    	let t31;
    	let br52;
    	let br53;
    	let br54;
    	let br55;
    	let br56;
    	let br57;
    	let br58;
    	let br59;
    	let t32;
    	let img25;
    	let img25_src_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			div0 = element("div");
    			iframe = element("iframe");
    			script = element("script");
    			t1 = space();
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			t2 = space();
    			img0 = element("img");
    			t3 = space();
    			img1 = element("img");
    			br10 = element("br");
    			t4 = space();
    			img2 = element("img");
    			t5 = space();
    			img3 = element("img");
    			t6 = space();
    			img4 = element("img");
    			t7 = space();
    			img5 = element("img");
    			br11 = element("br");
    			t8 = space();
    			img6 = element("img");
    			t9 = space();
    			img7 = element("img");
    			br12 = element("br");
    			t10 = space();
    			img8 = element("img");
    			t11 = space();
    			img9 = element("img");
    			t12 = space();
    			img10 = element("img");
    			br13 = element("br");
    			t13 = space();
    			img11 = element("img");
    			t14 = space();
    			img12 = element("img");
    			br14 = element("br");
    			t15 = space();
    			img13 = element("img");
    			t16 = space();
    			img14 = element("img");
    			br15 = element("br");
    			t17 = space();
    			br16 = element("br");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			br20 = element("br");
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			t18 = space();
    			img15 = element("img");
    			t19 = space();
    			img16 = element("img");
    			br24 = element("br");
    			t20 = space();
    			img17 = element("img");
    			t21 = space();
    			img18 = element("img");
    			br25 = element("br");
    			t22 = space();
    			br26 = element("br");
    			br27 = element("br");
    			br28 = element("br");
    			br29 = element("br");
    			br30 = element("br");
    			br31 = element("br");
    			br32 = element("br");
    			br33 = element("br");
    			t23 = space();
    			img19 = element("img");
    			t24 = space();
    			img20 = element("img");
    			t25 = space();
    			br34 = element("br");
    			br35 = element("br");
    			br36 = element("br");
    			br37 = element("br");
    			br38 = element("br");
    			br39 = element("br");
    			br40 = element("br");
    			br41 = element("br");
    			t26 = space();
    			img21 = element("img");
    			br42 = element("br");
    			t27 = space();
    			img22 = element("img");
    			t28 = space();
    			img23 = element("img");
    			t29 = space();
    			br43 = element("br");
    			br44 = element("br");
    			br45 = element("br");
    			br46 = element("br");
    			br47 = element("br");
    			br48 = element("br");
    			br49 = element("br");
    			br50 = element("br");
    			t30 = space();
    			img24 = element("img");
    			br51 = element("br");
    			t31 = space();
    			br52 = element("br");
    			br53 = element("br");
    			br54 = element("br");
    			br55 = element("br");
    			br56 = element("br");
    			br57 = element("br");
    			br58 = element("br");
    			br59 = element("br");
    			t32 = space();
    			img25 = element("img");
    			add_location(br0, file$l, 6, 1, 54);
    			add_location(br1, file$l, 6, 5, 58);
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/488284876?autoplay=1&loop=1&color=ffffff&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "class", "video-flora svelte-106wltv");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$l, 7, 54, 117);
    			set_style(div0, "padding", "56.25% 0 0 0");
    			set_style(div0, "position", "relative");
    			add_location(div0, file$l, 7, 1, 64);
    			if (script.src !== (script_src_value = "https://player.vimeo.com/api/player.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$l, 7, 264, 327);
    			add_location(br2, file$l, 8, 1, 391);
    			add_location(br3, file$l, 8, 5, 395);
    			add_location(br4, file$l, 8, 9, 399);
    			add_location(br5, file$l, 8, 13, 403);
    			add_location(br6, file$l, 8, 17, 407);
    			add_location(br7, file$l, 8, 21, 411);
    			add_location(br8, file$l, 8, 25, 415);
    			add_location(br9, file$l, 8, 29, 419);
    			attr_dev(img0, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/flora/front-desktop.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$l, 9, 1, 425);
    			attr_dev(img1, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/flora/front-mobile.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$l, 10, 1, 507);
    			add_location(br10, file$l, 10, 88, 594);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/flora/grein1-mobile.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$l, 11, 1, 600);
    			attr_dev(img3, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/flora/grein1-desktop.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$l, 12, 1, 690);
    			attr_dev(img4, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/flora/grein1c-desktop.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$l, 13, 1, 773);
    			attr_dev(img5, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/flora/grein1d-desktop.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$l, 14, 1, 857);
    			add_location(br11, file$l, 14, 83, 939);
    			attr_dev(img6, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/flora/grein2-mobile.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$l, 15, 1, 945);
    			attr_dev(img7, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/flora/grein2b-mobile.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$l, 16, 1, 1035);
    			add_location(br12, file$l, 16, 90, 1124);
    			attr_dev(img8, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/flora/utgafa7-mobile.png")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$l, 17, 1, 1130);
    			attr_dev(img9, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/flora/utgafa5-mobile.png")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$l, 18, 1, 1221);
    			attr_dev(img10, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/flora/utgafa-desktop.png")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$l, 19, 1, 1312);
    			add_location(br13, file$l, 19, 82, 1393);
    			attr_dev(img11, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/flora/flaedi-mobile.png")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$l, 20, 1, 1399);
    			attr_dev(img12, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img12, "alt", "mynd");
    			if (img12.src !== (img12_src_value = "igms/flora/flaedi-desktop.png")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$l, 21, 1, 1489);
    			add_location(br14, file$l, 21, 82, 1570);
    			attr_dev(img13, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img13, "alt", "mynd");
    			if (img13.src !== (img13_src_value = "igms/flora/leita-desktop.png")) attr_dev(img13, "src", img13_src_value);
    			add_location(img13, file$l, 22, 1, 1576);
    			attr_dev(img14, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img14, "alt", "mynd");
    			if (img14.src !== (img14_src_value = "igms/flora/leita-mobile.png")) attr_dev(img14, "src", img14_src_value);
    			add_location(img14, file$l, 23, 1, 1658);
    			add_location(br15, file$l, 23, 88, 1745);
    			add_location(br16, file$l, 24, 1, 1751);
    			add_location(br17, file$l, 24, 5, 1755);
    			add_location(br18, file$l, 24, 9, 1759);
    			add_location(br19, file$l, 24, 13, 1763);
    			add_location(br20, file$l, 24, 17, 1767);
    			add_location(br21, file$l, 24, 21, 1771);
    			add_location(br22, file$l, 24, 25, 1775);
    			add_location(br23, file$l, 24, 29, 1779);
    			attr_dev(img15, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img15, "alt", "mynd");
    			if (img15.src !== (img15_src_value = "igms/undefined-posters/druslaXflora-poster-litil-en.jpg")) attr_dev(img15, "src", img15_src_value);
    			add_location(img15, file$l, 25, 1, 1785);
    			attr_dev(img16, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img16, "alt", "mynd");
    			if (img16.src !== (img16_src_value = "igms/undefined-posters/druslaXflora-poster-stor-en.jpg")) attr_dev(img16, "src", img16_src_value);
    			add_location(img16, file$l, 26, 1, 1894);
    			add_location(br24, file$l, 26, 107, 2000);
    			attr_dev(img17, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img17, "alt", "mynd");
    			if (img17.src !== (img17_src_value = "igms/undefined-posters/druslaXflora-poster-litil-isl.jpg")) attr_dev(img17, "src", img17_src_value);
    			add_location(img17, file$l, 27, 1, 2006);
    			attr_dev(img18, "class", "img portfolio-item svelte-106wltv");
    			attr_dev(img18, "alt", "mynd");
    			if (img18.src !== (img18_src_value = "igms/undefined-posters/druslaXflora-poster-stor-isl.jpg")) attr_dev(img18, "src", img18_src_value);
    			add_location(img18, file$l, 28, 1, 2116);
    			add_location(br25, file$l, 28, 108, 2223);
    			add_location(br26, file$l, 29, 1, 2229);
    			add_location(br27, file$l, 29, 5, 2233);
    			add_location(br28, file$l, 29, 9, 2237);
    			add_location(br29, file$l, 29, 13, 2241);
    			add_location(br30, file$l, 29, 17, 2245);
    			add_location(br31, file$l, 29, 21, 2249);
    			add_location(br32, file$l, 29, 25, 2253);
    			add_location(br33, file$l, 29, 29, 2257);
    			attr_dev(img19, "class", "img portfolio-item larger svelte-106wltv");
    			attr_dev(img19, "alt", "mynd");
    			if (img19.src !== (img19_src_value = "igms/flora/plaggadd.jpg")) attr_dev(img19, "src", img19_src_value);
    			add_location(img19, file$l, 30, 1, 2263);
    			attr_dev(img20, "class", "img portfolio-item smaller svelte-106wltv");
    			attr_dev(img20, "alt", "mynd");
    			if (img20.src !== (img20_src_value = "igms/flora/banner.gif")) attr_dev(img20, "src", img20_src_value);
    			add_location(img20, file$l, 31, 1, 2347);
    			add_location(br34, file$l, 32, 1, 2430);
    			add_location(br35, file$l, 32, 5, 2434);
    			add_location(br36, file$l, 32, 9, 2438);
    			add_location(br37, file$l, 32, 13, 2442);
    			add_location(br38, file$l, 32, 17, 2446);
    			add_location(br39, file$l, 32, 21, 2450);
    			add_location(br40, file$l, 32, 25, 2454);
    			add_location(br41, file$l, 32, 29, 2458);
    			attr_dev(img21, "class", "img portfolio-item larger svelte-106wltv");
    			attr_dev(img21, "alt", "mynd");
    			if (img21.src !== (img21_src_value = "igms/flora/spurn.png")) attr_dev(img21, "src", img21_src_value);
    			add_location(img21, file$l, 33, 1, 2464);
    			add_location(br42, file$l, 33, 80, 2543);
    			attr_dev(img22, "class", "img portfolio-item larger svelte-106wltv");
    			attr_dev(img22, "alt", "mynd");
    			if (img22.src !== (img22_src_value = "igms/flora/tik.png")) attr_dev(img22, "src", img22_src_value);
    			add_location(img22, file$l, 34, 1, 2549);
    			attr_dev(img23, "class", "img portfolio-item larger svelte-106wltv");
    			attr_dev(img23, "alt", "mynd");
    			if (img23.src !== (img23_src_value = "igms/flora/baradyr.jpg")) attr_dev(img23, "src", img23_src_value);
    			add_location(img23, file$l, 35, 1, 2628);
    			add_location(br43, file$l, 36, 1, 2711);
    			add_location(br44, file$l, 36, 5, 2715);
    			add_location(br45, file$l, 36, 9, 2719);
    			add_location(br46, file$l, 36, 13, 2723);
    			add_location(br47, file$l, 36, 17, 2727);
    			add_location(br48, file$l, 36, 21, 2731);
    			add_location(br49, file$l, 36, 25, 2735);
    			add_location(br50, file$l, 36, 29, 2739);
    			attr_dev(img24, "class", "img portfolio-item larger svelte-106wltv");
    			attr_dev(img24, "alt", "mynd");
    			if (img24.src !== (img24_src_value = "igms/flora/handonlæri2.png")) attr_dev(img24, "src", img24_src_value);
    			add_location(img24, file$l, 37, 1, 2745);
    			add_location(br51, file$l, 37, 86, 2830);
    			add_location(br52, file$l, 38, 1, 2836);
    			add_location(br53, file$l, 38, 5, 2840);
    			add_location(br54, file$l, 38, 9, 2844);
    			add_location(br55, file$l, 38, 13, 2848);
    			add_location(br56, file$l, 38, 17, 2852);
    			add_location(br57, file$l, 38, 21, 2856);
    			add_location(br58, file$l, 38, 25, 2860);
    			add_location(br59, file$l, 38, 29, 2864);
    			attr_dev(img25, "class", "img portfolio-item smaller fixedlogo svelte-106wltv");
    			attr_dev(img25, "alt", "mynd");
    			if (img25.src !== (img25_src_value = "igms/flora/logo-flora.png")) attr_dev(img25, "src", img25_src_value);
    			add_location(img25, file$l, 39, 1, 2870);
    			attr_dev(div1, "class", "backgroundcolor svelte-106wltv");
    			add_location(div1, file$l, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, br0);
    			append_dev(div1, br1);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    			append_dev(div1, script);
    			append_dev(div1, t1);
    			append_dev(div1, br2);
    			append_dev(div1, br3);
    			append_dev(div1, br4);
    			append_dev(div1, br5);
    			append_dev(div1, br6);
    			append_dev(div1, br7);
    			append_dev(div1, br8);
    			append_dev(div1, br9);
    			append_dev(div1, t2);
    			append_dev(div1, img0);
    			append_dev(div1, t3);
    			append_dev(div1, img1);
    			append_dev(div1, br10);
    			append_dev(div1, t4);
    			append_dev(div1, img2);
    			append_dev(div1, t5);
    			append_dev(div1, img3);
    			append_dev(div1, t6);
    			append_dev(div1, img4);
    			append_dev(div1, t7);
    			append_dev(div1, img5);
    			append_dev(div1, br11);
    			append_dev(div1, t8);
    			append_dev(div1, img6);
    			append_dev(div1, t9);
    			append_dev(div1, img7);
    			append_dev(div1, br12);
    			append_dev(div1, t10);
    			append_dev(div1, img8);
    			append_dev(div1, t11);
    			append_dev(div1, img9);
    			append_dev(div1, t12);
    			append_dev(div1, img10);
    			append_dev(div1, br13);
    			append_dev(div1, t13);
    			append_dev(div1, img11);
    			append_dev(div1, t14);
    			append_dev(div1, img12);
    			append_dev(div1, br14);
    			append_dev(div1, t15);
    			append_dev(div1, img13);
    			append_dev(div1, t16);
    			append_dev(div1, img14);
    			append_dev(div1, br15);
    			append_dev(div1, t17);
    			append_dev(div1, br16);
    			append_dev(div1, br17);
    			append_dev(div1, br18);
    			append_dev(div1, br19);
    			append_dev(div1, br20);
    			append_dev(div1, br21);
    			append_dev(div1, br22);
    			append_dev(div1, br23);
    			append_dev(div1, t18);
    			append_dev(div1, img15);
    			append_dev(div1, t19);
    			append_dev(div1, img16);
    			append_dev(div1, br24);
    			append_dev(div1, t20);
    			append_dev(div1, img17);
    			append_dev(div1, t21);
    			append_dev(div1, img18);
    			append_dev(div1, br25);
    			append_dev(div1, t22);
    			append_dev(div1, br26);
    			append_dev(div1, br27);
    			append_dev(div1, br28);
    			append_dev(div1, br29);
    			append_dev(div1, br30);
    			append_dev(div1, br31);
    			append_dev(div1, br32);
    			append_dev(div1, br33);
    			append_dev(div1, t23);
    			append_dev(div1, img19);
    			append_dev(div1, t24);
    			append_dev(div1, img20);
    			append_dev(div1, t25);
    			append_dev(div1, br34);
    			append_dev(div1, br35);
    			append_dev(div1, br36);
    			append_dev(div1, br37);
    			append_dev(div1, br38);
    			append_dev(div1, br39);
    			append_dev(div1, br40);
    			append_dev(div1, br41);
    			append_dev(div1, t26);
    			append_dev(div1, img21);
    			append_dev(div1, br42);
    			append_dev(div1, t27);
    			append_dev(div1, img22);
    			append_dev(div1, t28);
    			append_dev(div1, img23);
    			append_dev(div1, t29);
    			append_dev(div1, br43);
    			append_dev(div1, br44);
    			append_dev(div1, br45);
    			append_dev(div1, br46);
    			append_dev(div1, br47);
    			append_dev(div1, br48);
    			append_dev(div1, br49);
    			append_dev(div1, br50);
    			append_dev(div1, t30);
    			append_dev(div1, img24);
    			append_dev(div1, br51);
    			append_dev(div1, t31);
    			append_dev(div1, br52);
    			append_dev(div1, br53);
    			append_dev(div1, br54);
    			append_dev(div1, br55);
    			append_dev(div1, br56);
    			append_dev(div1, br57);
    			append_dev(div1, br58);
    			append_dev(div1, br59);
    			append_dev(div1, t32);
    			append_dev(div1, img25);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Flora> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Flora", $$slots, []);
    	return [];
    }

    class Flora extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$l, create_fragment$l, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Flora",
    			options,
    			id: create_fragment$l.name
    		});
    	}
    }

    /* src/specifics/Breadmag.svelte generated by Svelte v3.23.0 */

    const file$m = "src/specifics/Breadmag.svelte";

    function create_fragment$m(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br2;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let t5;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			img1 = element("img");
    			br2 = element("br");
    			t2 = space();
    			img2 = element("img");
    			t3 = space();
    			img3 = element("img");
    			t4 = space();
    			img4 = element("img");
    			t5 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			add_location(br0, file$m, 6, 1, 54);
    			add_location(br1, file$m, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-ajr8db");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/bread/giant.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$m, 10, 1, 85);
    			attr_dev(img1, "class", "img portfolio-item svelte-ajr8db");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/bread/letthemeat.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$m, 11, 1, 159);
    			add_location(br2, file$m, 11, 78, 236);
    			attr_dev(img2, "class", "img portfolio-item svelte-ajr8db");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/bread/magclose.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$m, 12, 1, 242);
    			attr_dev(img3, "class", "img portfolio-item svelte-ajr8db");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/bread/mag1.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$m, 13, 1, 319);
    			attr_dev(img4, "class", "img portfolio-item svelte-ajr8db");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/bread/letthemeattitle.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$m, 14, 1, 392);
    			add_location(br3, file$m, 16, 1, 477);
    			add_location(br4, file$m, 16, 5, 481);
    			add_location(br5, file$m, 16, 9, 485);
    			add_location(br6, file$m, 16, 13, 489);
    			add_location(br7, file$m, 16, 17, 493);
    			add_location(br8, file$m, 16, 21, 497);
    			add_location(br9, file$m, 16, 25, 501);
    			add_location(br10, file$m, 16, 29, 505);
    			attr_dev(div, "class", "backgroundcolor svelte-ajr8db");
    			add_location(div, file$m, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, t5);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Breadmag> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Breadmag", $$slots, []);
    	return [];
    }

    class Breadmag extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Breadmag",
    			options,
    			id: create_fragment$m.name
    		});
    	}
    }

    /* src/specifics/Evublad.svelte generated by Svelte v3.23.0 */

    const file$n = "src/specifics/Evublad.svelte";

    function create_fragment$n(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let br2;
    	let t1;
    	let img1;
    	let img1_src_value;
    	let br3;
    	let t2;
    	let img2;
    	let img2_src_value;
    	let br4;
    	let t3;
    	let img3;
    	let img3_src_value;
    	let br5;
    	let t4;
    	let img4;
    	let img4_src_value;
    	let br6;
    	let t5;
    	let img5;
    	let img5_src_value;
    	let br7;
    	let t6;
    	let img6;
    	let img6_src_value;
    	let br8;
    	let t7;
    	let br9;
    	let br10;
    	let br11;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let br16;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			br2 = element("br");
    			t1 = space();
    			img1 = element("img");
    			br3 = element("br");
    			t2 = space();
    			img2 = element("img");
    			br4 = element("br");
    			t3 = space();
    			img3 = element("img");
    			br5 = element("br");
    			t4 = space();
    			img4 = element("img");
    			br6 = element("br");
    			t5 = space();
    			img5 = element("img");
    			br7 = element("br");
    			t6 = space();
    			img6 = element("img");
    			br8 = element("br");
    			t7 = space();
    			br9 = element("br");
    			br10 = element("br");
    			br11 = element("br");
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			add_location(br0, file$n, 6, 1, 54);
    			add_location(br1, file$n, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/evublad/evublad-spreads0.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$n, 7, 1, 64);
    			add_location(br2, file$n, 7, 86, 149);
    			attr_dev(img1, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/evublad/evublad-spreads2.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$n, 8, 1, 155);
    			add_location(br3, file$n, 8, 86, 240);
    			attr_dev(img2, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/evublad/evublad-spreads4.jpg")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$n, 9, 1, 246);
    			add_location(br4, file$n, 9, 86, 331);
    			attr_dev(img3, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/evublad/evublad-spreads5.jpg")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$n, 10, 1, 337);
    			add_location(br5, file$n, 10, 86, 422);
    			attr_dev(img4, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/evublad/evublad-spreads6.jpg")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$n, 11, 1, 428);
    			add_location(br6, file$n, 11, 86, 513);
    			attr_dev(img5, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/evublad/evublad-spreads7.jpg")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$n, 12, 1, 519);
    			add_location(br7, file$n, 12, 86, 604);
    			attr_dev(img6, "class", "img portfolio-item svelte-fotrha");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/evublad/evublad-spreads9.jpg")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$n, 13, 1, 610);
    			add_location(br8, file$n, 13, 86, 695);
    			add_location(br9, file$n, 14, 1, 701);
    			add_location(br10, file$n, 14, 5, 705);
    			add_location(br11, file$n, 14, 9, 709);
    			add_location(br12, file$n, 14, 13, 713);
    			add_location(br13, file$n, 14, 17, 717);
    			add_location(br14, file$n, 14, 21, 721);
    			add_location(br15, file$n, 14, 25, 725);
    			add_location(br16, file$n, 14, 29, 729);
    			attr_dev(div, "class", "backgroundcolor svelte-fotrha");
    			add_location(div, file$n, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, br2);
    			append_dev(div, t1);
    			append_dev(div, img1);
    			append_dev(div, br3);
    			append_dev(div, t2);
    			append_dev(div, img2);
    			append_dev(div, br4);
    			append_dev(div, t3);
    			append_dev(div, img3);
    			append_dev(div, br5);
    			append_dev(div, t4);
    			append_dev(div, img4);
    			append_dev(div, br6);
    			append_dev(div, t5);
    			append_dev(div, img5);
    			append_dev(div, br7);
    			append_dev(div, t6);
    			append_dev(div, img6);
    			append_dev(div, br8);
    			append_dev(div, t7);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, br11);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Evublad> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Evublad", $$slots, []);
    	return [];
    }

    class Evublad extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Evublad",
    			options,
    			id: create_fragment$n.name
    		});
    	}
    }

    /* src/specifics/Somalgors.svelte generated by Svelte v3.23.0 */

    const file$o = "src/specifics/Somalgors.svelte";

    function create_fragment$o(ctx) {
    	let div;
    	let br0;
    	let br1;
    	let t0;
    	let img0;
    	let img0_src_value;
    	let t1;
    	let iframe;
    	let iframe_src_value;
    	let br2;
    	let t2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;
    	let br10;
    	let t3;
    	let img1;
    	let img1_src_value;
    	let br11;
    	let t4;
    	let br12;
    	let br13;
    	let br14;
    	let br15;
    	let br16;
    	let br17;
    	let br18;
    	let br19;
    	let t5;
    	let img2;
    	let img2_src_value;
    	let t6;
    	let img3;
    	let img3_src_value;
    	let t7;
    	let img4;
    	let img4_src_value;
    	let t8;
    	let img5;
    	let img5_src_value;
    	let t9;
    	let img6;
    	let img6_src_value;
    	let t10;
    	let img7;
    	let img7_src_value;
    	let t11;
    	let img8;
    	let img8_src_value;
    	let t12;
    	let img9;
    	let img9_src_value;
    	let t13;
    	let br20;
    	let br21;
    	let br22;
    	let br23;
    	let br24;
    	let br25;
    	let br26;
    	let br27;
    	let t14;
    	let img10;
    	let img10_src_value;
    	let br28;
    	let br29;
    	let t15;
    	let img11;
    	let img11_src_value;
    	let br30;
    	let br31;
    	let t16;
    	let img12;
    	let img12_src_value;
    	let br32;
    	let br33;
    	let t17;
    	let img13;
    	let img13_src_value;
    	let br34;
    	let br35;
    	let t18;
    	let img14;
    	let img14_src_value;
    	let t19;
    	let br36;
    	let br37;
    	let br38;
    	let br39;
    	let br40;
    	let br41;
    	let br42;
    	let br43;
    	let t20;
    	let img15;
    	let img15_src_value;
    	let t21;
    	let img16;
    	let img16_src_value;
    	let t22;
    	let br44;
    	let br45;
    	let br46;
    	let br47;
    	let br48;
    	let br49;
    	let br50;
    	let br51;
    	let t23;
    	let img17;
    	let img17_src_value;
    	let br52;
    	let t24;
    	let img18;
    	let img18_src_value;
    	let t25;
    	let img19;
    	let img19_src_value;
    	let br53;
    	let t26;
    	let img20;
    	let img20_src_value;
    	let t27;
    	let img21;
    	let img21_src_value;
    	let t28;
    	let br54;
    	let br55;
    	let br56;
    	let br57;
    	let br58;
    	let br59;
    	let br60;
    	let br61;

    	const block = {
    		c: function create() {
    			div = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			img0 = element("img");
    			t1 = space();
    			iframe = element("iframe");
    			br2 = element("br");
    			t2 = space();
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			br10 = element("br");
    			t3 = space();
    			img1 = element("img");
    			br11 = element("br");
    			t4 = space();
    			br12 = element("br");
    			br13 = element("br");
    			br14 = element("br");
    			br15 = element("br");
    			br16 = element("br");
    			br17 = element("br");
    			br18 = element("br");
    			br19 = element("br");
    			t5 = space();
    			img2 = element("img");
    			t6 = space();
    			img3 = element("img");
    			t7 = space();
    			img4 = element("img");
    			t8 = space();
    			img5 = element("img");
    			t9 = space();
    			img6 = element("img");
    			t10 = space();
    			img7 = element("img");
    			t11 = space();
    			img8 = element("img");
    			t12 = space();
    			img9 = element("img");
    			t13 = space();
    			br20 = element("br");
    			br21 = element("br");
    			br22 = element("br");
    			br23 = element("br");
    			br24 = element("br");
    			br25 = element("br");
    			br26 = element("br");
    			br27 = element("br");
    			t14 = space();
    			img10 = element("img");
    			br28 = element("br");
    			br29 = element("br");
    			t15 = space();
    			img11 = element("img");
    			br30 = element("br");
    			br31 = element("br");
    			t16 = space();
    			img12 = element("img");
    			br32 = element("br");
    			br33 = element("br");
    			t17 = space();
    			img13 = element("img");
    			br34 = element("br");
    			br35 = element("br");
    			t18 = space();
    			img14 = element("img");
    			t19 = space();
    			br36 = element("br");
    			br37 = element("br");
    			br38 = element("br");
    			br39 = element("br");
    			br40 = element("br");
    			br41 = element("br");
    			br42 = element("br");
    			br43 = element("br");
    			t20 = space();
    			img15 = element("img");
    			t21 = space();
    			img16 = element("img");
    			t22 = space();
    			br44 = element("br");
    			br45 = element("br");
    			br46 = element("br");
    			br47 = element("br");
    			br48 = element("br");
    			br49 = element("br");
    			br50 = element("br");
    			br51 = element("br");
    			t23 = space();
    			img17 = element("img");
    			br52 = element("br");
    			t24 = space();
    			img18 = element("img");
    			t25 = space();
    			img19 = element("img");
    			br53 = element("br");
    			t26 = space();
    			img20 = element("img");
    			t27 = space();
    			img21 = element("img");
    			t28 = space();
    			br54 = element("br");
    			br55 = element("br");
    			br56 = element("br");
    			br57 = element("br");
    			br58 = element("br");
    			br59 = element("br");
    			br60 = element("br");
    			br61 = element("br");
    			add_location(br0, file$o, 6, 1, 54);
    			add_location(br1, file$o, 6, 5, 58);
    			attr_dev(img0, "class", "img portfolio-item fyrsta-mynd svelte-wptb68");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/somalgors74/vitrine.jpg")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$o, 7, 1, 64);
    			attr_dev(iframe, "class", "out-on-mobile");
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/488240278?autoplay=1&loop=1&color=ffffff&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "width", "640");
    			attr_dev(iframe, "height", "905");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$o, 8, 1, 158);
    			add_location(br2, file$o, 8, 232, 389);
    			add_location(br3, file$o, 10, 1, 397);
    			add_location(br4, file$o, 10, 5, 401);
    			add_location(br5, file$o, 10, 9, 405);
    			add_location(br6, file$o, 10, 13, 409);
    			add_location(br7, file$o, 10, 17, 413);
    			add_location(br8, file$o, 10, 21, 417);
    			add_location(br9, file$o, 10, 25, 421);
    			add_location(br10, file$o, 10, 29, 425);
    			attr_dev(img1, "class", "img portfolio-item svelte-wptb68");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/somalgors74/vitrine-in-box.jpg")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$o, 11, 1, 431);
    			add_location(br11, file$o, 11, 88, 518);
    			add_location(br12, file$o, 12, 1, 524);
    			add_location(br13, file$o, 12, 5, 528);
    			add_location(br14, file$o, 12, 9, 532);
    			add_location(br15, file$o, 12, 13, 536);
    			add_location(br16, file$o, 12, 17, 540);
    			add_location(br17, file$o, 12, 21, 544);
    			add_location(br18, file$o, 12, 25, 548);
    			add_location(br19, file$o, 12, 29, 552);
    			attr_dev(img2, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/somalgors74/cover.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$o, 13, 1, 558);
    			attr_dev(img3, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img3, "alt", "mynd");
    			if (img3.src !== (img3_src_value = "igms/somalgors74/1.png")) attr_dev(img3, "src", img3_src_value);
    			add_location(img3, file$o, 14, 1, 646);
    			attr_dev(img4, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img4, "alt", "mynd");
    			if (img4.src !== (img4_src_value = "igms/somalgors74/2.png")) attr_dev(img4, "src", img4_src_value);
    			add_location(img4, file$o, 15, 1, 730);
    			attr_dev(img5, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img5, "alt", "mynd");
    			if (img5.src !== (img5_src_value = "igms/somalgors74/3.png")) attr_dev(img5, "src", img5_src_value);
    			add_location(img5, file$o, 16, 1, 814);
    			attr_dev(img6, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img6, "alt", "mynd");
    			if (img6.src !== (img6_src_value = "igms/somalgors74/5.png")) attr_dev(img6, "src", img6_src_value);
    			add_location(img6, file$o, 18, 1, 989);
    			attr_dev(img7, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img7, "alt", "mynd");
    			if (img7.src !== (img7_src_value = "igms/somalgors74/7.png")) attr_dev(img7, "src", img7_src_value);
    			add_location(img7, file$o, 20, 1, 1164);
    			attr_dev(img8, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img8, "alt", "mynd");
    			if (img8.src !== (img8_src_value = "igms/somalgors74/8.png")) attr_dev(img8, "src", img8_src_value);
    			add_location(img8, file$o, 21, 1, 1248);
    			attr_dev(img9, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img9, "alt", "mynd");
    			if (img9.src !== (img9_src_value = "igms/somalgors74/9.png")) attr_dev(img9, "src", img9_src_value);
    			add_location(img9, file$o, 22, 1, 1332);
    			add_location(br20, file$o, 23, 1, 1417);
    			add_location(br21, file$o, 23, 5, 1421);
    			add_location(br22, file$o, 23, 9, 1425);
    			add_location(br23, file$o, 23, 13, 1429);
    			add_location(br24, file$o, 23, 17, 1433);
    			add_location(br25, file$o, 23, 21, 1437);
    			add_location(br26, file$o, 23, 25, 1441);
    			add_location(br27, file$o, 23, 29, 1445);
    			attr_dev(img10, "class", "img portfolio-item larger svelte-wptb68");
    			attr_dev(img10, "alt", "mynd");
    			if (img10.src !== (img10_src_value = "igms/somalgors74/web0.png")) attr_dev(img10, "src", img10_src_value);
    			add_location(img10, file$o, 24, 1, 1451);
    			add_location(br28, file$o, 24, 85, 1535);
    			add_location(br29, file$o, 24, 89, 1539);
    			attr_dev(img11, "class", "img portfolio-item larger svelte-wptb68");
    			attr_dev(img11, "alt", "mynd");
    			if (img11.src !== (img11_src_value = "igms/somalgors74/web3.png")) attr_dev(img11, "src", img11_src_value);
    			add_location(img11, file$o, 25, 1, 1545);
    			add_location(br30, file$o, 25, 85, 1629);
    			add_location(br31, file$o, 25, 89, 1633);
    			attr_dev(img12, "class", "img portfolio-item larger svelte-wptb68");
    			attr_dev(img12, "alt", "mynd");
    			if (img12.src !== (img12_src_value = "igms/somalgors74/web4.png")) attr_dev(img12, "src", img12_src_value);
    			add_location(img12, file$o, 26, 1, 1639);
    			add_location(br32, file$o, 26, 85, 1723);
    			add_location(br33, file$o, 26, 89, 1727);
    			attr_dev(img13, "class", "img portfolio-item larger svelte-wptb68");
    			attr_dev(img13, "alt", "mynd");
    			if (img13.src !== (img13_src_value = "igms/somalgors74/web1.png")) attr_dev(img13, "src", img13_src_value);
    			add_location(img13, file$o, 27, 1, 1733);
    			add_location(br34, file$o, 27, 85, 1817);
    			add_location(br35, file$o, 27, 89, 1821);
    			attr_dev(img14, "class", "img portfolio-item larger svelte-wptb68");
    			attr_dev(img14, "alt", "mynd");
    			if (img14.src !== (img14_src_value = "igms/somalgors74/web2.png")) attr_dev(img14, "src", img14_src_value);
    			add_location(img14, file$o, 28, 1, 1827);
    			add_location(br36, file$o, 29, 1, 1913);
    			add_location(br37, file$o, 29, 5, 1917);
    			add_location(br38, file$o, 29, 9, 1921);
    			add_location(br39, file$o, 29, 13, 1925);
    			add_location(br40, file$o, 29, 17, 1929);
    			add_location(br41, file$o, 29, 21, 1933);
    			add_location(br42, file$o, 29, 25, 1937);
    			add_location(br43, file$o, 29, 29, 1941);
    			attr_dev(img15, "class", "img portfolio-item smallest svelte-wptb68");
    			attr_dev(img15, "alt", "mynd");
    			if (img15.src !== (img15_src_value = "igms/somalgors74/stickers.png")) attr_dev(img15, "src", img15_src_value);
    			add_location(img15, file$o, 31, 1, 2058);
    			attr_dev(img16, "class", "img portfolio-item smallest svelte-wptb68");
    			attr_dev(img16, "alt", "mynd");
    			if (img16.src !== (img16_src_value = "igms/somalgors74/stickers2.png")) attr_dev(img16, "src", img16_src_value);
    			add_location(img16, file$o, 32, 1, 2150);
    			add_location(br44, file$o, 33, 1, 2244);
    			add_location(br45, file$o, 33, 5, 2248);
    			add_location(br46, file$o, 33, 9, 2252);
    			add_location(br47, file$o, 33, 13, 2256);
    			add_location(br48, file$o, 33, 17, 2260);
    			add_location(br49, file$o, 33, 21, 2264);
    			add_location(br50, file$o, 33, 25, 2268);
    			add_location(br51, file$o, 33, 29, 2272);
    			attr_dev(img17, "class", "img portfolio-item larger svelte-wptb68");
    			attr_dev(img17, "alt", "mynd");
    			if (img17.src !== (img17_src_value = "igms/somalgors74/baernytt.jpg")) attr_dev(img17, "src", img17_src_value);
    			add_location(img17, file$o, 34, 1, 2279);
    			add_location(br52, file$o, 34, 89, 2367);
    			attr_dev(img18, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img18, "alt", "mynd");
    			if (img18.src !== (img18_src_value = "igms/somalgors74/small.jpg")) attr_dev(img18, "src", img18_src_value);
    			add_location(img18, file$o, 35, 1, 2373);
    			attr_dev(img19, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img19, "alt", "mynd");
    			if (img19.src !== (img19_src_value = "igms/somalgors74/matur2.jpg")) attr_dev(img19, "src", img19_src_value);
    			add_location(img19, file$o, 36, 1, 2461);
    			add_location(br53, file$o, 36, 88, 2548);
    			attr_dev(img20, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img20, "alt", "mynd");
    			if (img20.src !== (img20_src_value = "igms/somalgors74/matur1.jpg")) attr_dev(img20, "src", img20_src_value);
    			add_location(img20, file$o, 37, 1, 2554);
    			attr_dev(img21, "class", "img portfolio-item smaller svelte-wptb68");
    			attr_dev(img21, "alt", "mynd");
    			if (img21.src !== (img21_src_value = "igms/somalgors74/matur3.jpg")) attr_dev(img21, "src", img21_src_value);
    			add_location(img21, file$o, 38, 1, 2643);
    			add_location(br54, file$o, 39, 1, 2732);
    			add_location(br55, file$o, 39, 5, 2736);
    			add_location(br56, file$o, 39, 9, 2740);
    			add_location(br57, file$o, 39, 13, 2744);
    			add_location(br58, file$o, 39, 17, 2748);
    			add_location(br59, file$o, 39, 21, 2752);
    			add_location(br60, file$o, 39, 25, 2756);
    			add_location(br61, file$o, 39, 29, 2760);
    			attr_dev(div, "class", "backgroundcolor svelte-wptb68");
    			add_location(div, file$o, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, br0);
    			append_dev(div, br1);
    			append_dev(div, t0);
    			append_dev(div, img0);
    			append_dev(div, t1);
    			append_dev(div, iframe);
    			append_dev(div, br2);
    			append_dev(div, t2);
    			append_dev(div, br3);
    			append_dev(div, br4);
    			append_dev(div, br5);
    			append_dev(div, br6);
    			append_dev(div, br7);
    			append_dev(div, br8);
    			append_dev(div, br9);
    			append_dev(div, br10);
    			append_dev(div, t3);
    			append_dev(div, img1);
    			append_dev(div, br11);
    			append_dev(div, t4);
    			append_dev(div, br12);
    			append_dev(div, br13);
    			append_dev(div, br14);
    			append_dev(div, br15);
    			append_dev(div, br16);
    			append_dev(div, br17);
    			append_dev(div, br18);
    			append_dev(div, br19);
    			append_dev(div, t5);
    			append_dev(div, img2);
    			append_dev(div, t6);
    			append_dev(div, img3);
    			append_dev(div, t7);
    			append_dev(div, img4);
    			append_dev(div, t8);
    			append_dev(div, img5);
    			append_dev(div, t9);
    			append_dev(div, img6);
    			append_dev(div, t10);
    			append_dev(div, img7);
    			append_dev(div, t11);
    			append_dev(div, img8);
    			append_dev(div, t12);
    			append_dev(div, img9);
    			append_dev(div, t13);
    			append_dev(div, br20);
    			append_dev(div, br21);
    			append_dev(div, br22);
    			append_dev(div, br23);
    			append_dev(div, br24);
    			append_dev(div, br25);
    			append_dev(div, br26);
    			append_dev(div, br27);
    			append_dev(div, t14);
    			append_dev(div, img10);
    			append_dev(div, br28);
    			append_dev(div, br29);
    			append_dev(div, t15);
    			append_dev(div, img11);
    			append_dev(div, br30);
    			append_dev(div, br31);
    			append_dev(div, t16);
    			append_dev(div, img12);
    			append_dev(div, br32);
    			append_dev(div, br33);
    			append_dev(div, t17);
    			append_dev(div, img13);
    			append_dev(div, br34);
    			append_dev(div, br35);
    			append_dev(div, t18);
    			append_dev(div, img14);
    			append_dev(div, t19);
    			append_dev(div, br36);
    			append_dev(div, br37);
    			append_dev(div, br38);
    			append_dev(div, br39);
    			append_dev(div, br40);
    			append_dev(div, br41);
    			append_dev(div, br42);
    			append_dev(div, br43);
    			append_dev(div, t20);
    			append_dev(div, img15);
    			append_dev(div, t21);
    			append_dev(div, img16);
    			append_dev(div, t22);
    			append_dev(div, br44);
    			append_dev(div, br45);
    			append_dev(div, br46);
    			append_dev(div, br47);
    			append_dev(div, br48);
    			append_dev(div, br49);
    			append_dev(div, br50);
    			append_dev(div, br51);
    			append_dev(div, t23);
    			append_dev(div, img17);
    			append_dev(div, br52);
    			append_dev(div, t24);
    			append_dev(div, img18);
    			append_dev(div, t25);
    			append_dev(div, img19);
    			append_dev(div, br53);
    			append_dev(div, t26);
    			append_dev(div, img20);
    			append_dev(div, t27);
    			append_dev(div, img21);
    			append_dev(div, t28);
    			append_dev(div, br54);
    			append_dev(div, br55);
    			append_dev(div, br56);
    			append_dev(div, br57);
    			append_dev(div, br58);
    			append_dev(div, br59);
    			append_dev(div, br60);
    			append_dev(div, br61);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$o.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$o($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Somalgors> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Somalgors", $$slots, []);
    	return [];
    }

    class Somalgors extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$o, create_fragment$o, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Somalgors",
    			options,
    			id: create_fragment$o.name
    		});
    	}
    }

    /* src/specifics/Organogram.svelte generated by Svelte v3.23.0 */

    const file$p = "src/specifics/Organogram.svelte";

    function create_fragment$p(ctx) {
    	let div1;
    	let br0;
    	let br1;
    	let t0;
    	let div0;
    	let iframe;
    	let iframe_src_value;
    	let script;
    	let script_src_value;
    	let t1;
    	let img;
    	let img_src_value;
    	let t2;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let br6;
    	let br7;
    	let br8;
    	let br9;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			br0 = element("br");
    			br1 = element("br");
    			t0 = space();
    			div0 = element("div");
    			iframe = element("iframe");
    			script = element("script");
    			t1 = space();
    			img = element("img");
    			t2 = space();
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			br6 = element("br");
    			br7 = element("br");
    			br8 = element("br");
    			br9 = element("br");
    			add_location(br0, file$p, 6, 1, 54);
    			add_location(br1, file$p, 6, 5, 58);
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/488155896?autoplay=1&loop=1&color=ffffff&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			set_style(iframe, "position", "absolute");
    			set_style(iframe, "top", "5.5%");
    			set_style(iframe, "left", "15%");
    			set_style(iframe, "width", "70%");
    			set_style(iframe, "height", "80%");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$p, 7, 54, 117);
    			set_style(div0, "padding", "56.25% 0 0 0");
    			set_style(div0, "position", "relative");
    			add_location(div0, file$p, 7, 1, 64);
    			if (script.src !== (script_src_value = "https://player.vimeo.com/api/player.js")) attr_dev(script, "src", script_src_value);
    			add_location(script, file$p, 7, 310, 373);
    			attr_dev(img, "class", "img portfolio-item svelte-54sr07");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/organogram/poster-smaller.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$p, 8, 1, 437);
    			add_location(br2, file$p, 9, 1, 525);
    			add_location(br3, file$p, 9, 5, 529);
    			add_location(br4, file$p, 9, 9, 533);
    			add_location(br5, file$p, 9, 13, 537);
    			add_location(br6, file$p, 9, 17, 541);
    			add_location(br7, file$p, 9, 21, 545);
    			add_location(br8, file$p, 9, 25, 549);
    			add_location(br9, file$p, 9, 29, 553);
    			attr_dev(div1, "class", "backgroundcolor svelte-54sr07");
    			add_location(div1, file$p, 5, 0, 23);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, br0);
    			append_dev(div1, br1);
    			append_dev(div1, t0);
    			append_dev(div1, div0);
    			append_dev(div0, iframe);
    			append_dev(div1, script);
    			append_dev(div1, t1);
    			append_dev(div1, img);
    			append_dev(div1, t2);
    			append_dev(div1, br2);
    			append_dev(div1, br3);
    			append_dev(div1, br4);
    			append_dev(div1, br5);
    			append_dev(div1, br6);
    			append_dev(div1, br7);
    			append_dev(div1, br8);
    			append_dev(div1, br9);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$p.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$p($$self, $$props) {
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Organogram> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("Organogram", $$slots, []);
    	return [];
    }

    class Organogram extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$p, create_fragment$p, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Organogram",
    			options,
    			id: create_fragment$p.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.23.0 */
    const file$q = "src/App.svelte";

    // (502:3) {#if frontscreen}
    function create_if_block_185(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("March 2021");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_185.name,
    		type: "if",
    		source: "(502:3) {#if frontscreen}",
    		ctx
    	});

    	return block;
    }

    // (503:3) {#if onourowntime}
    function create_if_block_184(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2020");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_184.name,
    		type: "if",
    		source: "(503:3) {#if onourowntime}",
    		ctx
    	});

    	return block;
    }

    // (504:3) {#if green}
    function create_if_block_183(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Winter 2019-2020");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_183.name,
    		type: "if",
    		source: "(504:3) {#if green}",
    		ctx
    	});

    	return block;
    }

    // (505:3) {#if viv}
    function create_if_block_182(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2017");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_182.name,
    		type: "if",
    		source: "(505:3) {#if viv}",
    		ctx
    	});

    	return block;
    }

    // (506:3) {#if portfolioio}
    function create_if_block_181(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019 - 2020");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_181.name,
    		type: "if",
    		source: "(506:3) {#if portfolioio}",
    		ctx
    	});

    	return block;
    }

    // (507:3) {#if typoposters}
    function create_if_block_180(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_180.name,
    		type: "if",
    		source: "(507:3) {#if typoposters}",
    		ctx
    	});

    	return block;
    }

    // (508:3) {#if beauimg}
    function create_if_block_179(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_179.name,
    		type: "if",
    		source: "(508:3) {#if beauimg}",
    		ctx
    	});

    	return block;
    }

    // (509:3) {#if secret}
    function create_if_block_178(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2017");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_178.name,
    		type: "if",
    		source: "(509:3) {#if secret}",
    		ctx
    	});

    	return block;
    }

    // (510:3) {#if sortedplastic}
    function create_if_block_177(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_177.name,
    		type: "if",
    		source: "(510:3) {#if sortedplastic}",
    		ctx
    	});

    	return block;
    }

    // (511:3) {#if oeb}
    function create_if_block_176(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_176.name,
    		type: "if",
    		source: "(511:3) {#if oeb}",
    		ctx
    	});

    	return block;
    }

    // (512:3) {#if musicposters}
    function create_if_block_175(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_175.name,
    		type: "if",
    		source: "(512:3) {#if musicposters}",
    		ctx
    	});

    	return block;
    }

    // (513:3) {#if timatal}
    function create_if_block_174(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_174.name,
    		type: "if",
    		source: "(513:3) {#if timatal}",
    		ctx
    	});

    	return block;
    }

    // (514:3) {#if tools}
    function create_if_block_173(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_173.name,
    		type: "if",
    		source: "(514:3) {#if tools}",
    		ctx
    	});

    	return block;
    }

    // (515:3) {#if trash}
    function create_if_block_172(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_172.name,
    		type: "if",
    		source: "(515:3) {#if trash}",
    		ctx
    	});

    	return block;
    }

    // (516:3) {#if musicbook}
    function create_if_block_171(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2016");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_171.name,
    		type: "if",
    		source: "(516:3) {#if musicbook}",
    		ctx
    	});

    	return block;
    }

    // (517:3) {#if corruptedspace}
    function create_if_block_170(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_170.name,
    		type: "if",
    		source: "(517:3) {#if corruptedspace}",
    		ctx
    	});

    	return block;
    }

    // (518:3) {#if oilbuddies}
    function create_if_block_169(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2017");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_169.name,
    		type: "if",
    		source: "(518:3) {#if oilbuddies}",
    		ctx
    	});

    	return block;
    }

    // (519:3) {#if litabok}
    function create_if_block_168(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_168.name,
    		type: "if",
    		source: "(519:3) {#if litabok}",
    		ctx
    	});

    	return block;
    }

    // (520:3) {#if plastica}
    function create_if_block_167(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_167.name,
    		type: "if",
    		source: "(520:3) {#if plastica}",
    		ctx
    	});

    	return block;
    }

    // (521:3) {#if familiarfaces}
    function create_if_block_166(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_166.name,
    		type: "if",
    		source: "(521:3) {#if familiarfaces}",
    		ctx
    	});

    	return block;
    }

    // (522:3) {#if likamar}
    function create_if_block_165(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019 - 2020");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_165.name,
    		type: "if",
    		source: "(522:3) {#if likamar}",
    		ctx
    	});

    	return block;
    }

    // (523:3) {#if bread}
    function create_if_block_164(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_164.name,
    		type: "if",
    		source: "(523:3) {#if bread}",
    		ctx
    	});

    	return block;
    }

    // (524:3) {#if breadmag}
    function create_if_block_163(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2019");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_163.name,
    		type: "if",
    		source: "(524:3) {#if breadmag}",
    		ctx
    	});

    	return block;
    }

    // (525:3) {#if flora}
    function create_if_block_162(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Summer 2018 - ongoing");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_162.name,
    		type: "if",
    		source: "(525:3) {#if flora}",
    		ctx
    	});

    	return block;
    }

    // (526:4) {#if evublad}
    function create_if_block_161(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Spring 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_161.name,
    		type: "if",
    		source: "(526:4) {#if evublad}",
    		ctx
    	});

    	return block;
    }

    // (527:4) {#if somalgors}
    function create_if_block_160(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2019");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_160.name,
    		type: "if",
    		source: "(527:4) {#if somalgors}",
    		ctx
    	});

    	return block;
    }

    // (528:4) {#if organogram}
    function create_if_block_159(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Autumn 2018");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_159.name,
    		type: "if",
    		source: "(528:4) {#if organogram}",
    		ctx
    	});

    	return block;
    }

    // (532:3) {#if frontscreen}
    function create_if_block_158(ctx) {
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("Page last updated");
    			br = element("br");
    			t1 = text("March 2021.");
    			add_location(br, file$q, 531, 37, 29231);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_158.name,
    		type: "if",
    		source: "(532:3) {#if frontscreen}",
    		ctx
    	});

    	return block;
    }

    // (533:3) {#if onourowntime}
    function create_if_block_157(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_157.name,
    		type: "if",
    		source: "(533:3) {#if onourowntime}",
    		ctx
    	});

    	return block;
    }

    // (534:3) {#if green}
    function create_if_block_156(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_156.name,
    		type: "if",
    		source: "(534:3) {#if green}",
    		ctx
    	});

    	return block;
    }

    // (535:3) {#if viv}
    function create_if_block_155(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_155.name,
    		type: "if",
    		source: "(535:3) {#if viv}",
    		ctx
    	});

    	return block;
    }

    // (536:3) {#if bread}
    function create_if_block_154(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_154.name,
    		type: "if",
    		source: "(536:3) {#if bread}",
    		ctx
    	});

    	return block;
    }

    // (537:3) {#if breadmag}
    function create_if_block_153(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_153.name,
    		type: "if",
    		source: "(537:3) {#if breadmag}",
    		ctx
    	});

    	return block;
    }

    // (538:3) {#if portfolioio}
    function create_if_block_152(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_152.name,
    		type: "if",
    		source: "(538:3) {#if portfolioio}",
    		ctx
    	});

    	return block;
    }

    // (539:3) {#if typoposters}
    function create_if_block_151(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_151.name,
    		type: "if",
    		source: "(539:3) {#if typoposters}",
    		ctx
    	});

    	return block;
    }

    // (540:3) {#if beauimg}
    function create_if_block_150(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_150.name,
    		type: "if",
    		source: "(540:3) {#if beauimg}",
    		ctx
    	});

    	return block;
    }

    // (541:3) {#if secret}
    function create_if_block_149(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_149.name,
    		type: "if",
    		source: "(541:3) {#if secret}",
    		ctx
    	});

    	return block;
    }

    // (542:3) {#if sortedplastic}
    function create_if_block_148(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_148.name,
    		type: "if",
    		source: "(542:3) {#if sortedplastic}",
    		ctx
    	});

    	return block;
    }

    // (543:3) {#if oeb}
    function create_if_block_147(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_147.name,
    		type: "if",
    		source: "(543:3) {#if oeb}",
    		ctx
    	});

    	return block;
    }

    // (544:3) {#if musicposters}
    function create_if_block_146(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_146.name,
    		type: "if",
    		source: "(544:3) {#if musicposters}",
    		ctx
    	});

    	return block;
    }

    // (545:3) {#if timatal}
    function create_if_block_145(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_145.name,
    		type: "if",
    		source: "(545:3) {#if timatal}",
    		ctx
    	});

    	return block;
    }

    // (546:3) {#if tools}
    function create_if_block_144(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_144.name,
    		type: "if",
    		source: "(546:3) {#if tools}",
    		ctx
    	});

    	return block;
    }

    // (547:3) {#if trash}
    function create_if_block_143(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_143.name,
    		type: "if",
    		source: "(547:3) {#if trash}",
    		ctx
    	});

    	return block;
    }

    // (548:3) {#if musicbook}
    function create_if_block_142(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_142.name,
    		type: "if",
    		source: "(548:3) {#if musicbook}",
    		ctx
    	});

    	return block;
    }

    // (549:3) {#if corruptedspace}
    function create_if_block_141(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_141.name,
    		type: "if",
    		source: "(549:3) {#if corruptedspace}",
    		ctx
    	});

    	return block;
    }

    // (550:3) {#if oilbuddies}
    function create_if_block_140(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_140.name,
    		type: "if",
    		source: "(550:3) {#if oilbuddies}",
    		ctx
    	});

    	return block;
    }

    // (551:3) {#if litabok}
    function create_if_block_139(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_139.name,
    		type: "if",
    		source: "(551:3) {#if litabok}",
    		ctx
    	});

    	return block;
    }

    // (552:3) {#if plastica}
    function create_if_block_138(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_138.name,
    		type: "if",
    		source: "(552:3) {#if plastica}",
    		ctx
    	});

    	return block;
    }

    // (553:3) {#if familiarfaces}
    function create_if_block_137(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_137.name,
    		type: "if",
    		source: "(553:3) {#if familiarfaces}",
    		ctx
    	});

    	return block;
    }

    // (554:3) {#if likamar}
    function create_if_block_136(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Typeface initially designed in 2019, refined for Flóra útgáfa in 2020.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_136.name,
    		type: "if",
    		source: "(554:3) {#if likamar}",
    		ctx
    	});

    	return block;
    }

    // (555:3) {#if flora}
    function create_if_block_135(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Current website mostly designed and built in Summer 2020.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_135.name,
    		type: "if",
    		source: "(555:3) {#if flora}",
    		ctx
    	});

    	return block;
    }

    // (556:4) {#if evublad}
    function create_if_block_134(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("...");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_134.name,
    		type: "if",
    		source: "(556:4) {#if evublad}",
    		ctx
    	});

    	return block;
    }

    // (560:3) {#if frontscreen}
    function create_if_block_133(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Berglind Brá");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_133.name,
    		type: "if",
    		source: "(560:3) {#if frontscreen}",
    		ctx
    	});

    	return block;
    }

    // (561:3) {#if onourowntime}
    function create_if_block_132(ctx) {
    	let a;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "On our own time";
    			attr_dev(a, "href", "https://onourowntime.today/");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$q, 560, 21, 30112);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_132.name,
    		type: "if",
    		source: "(561:3) {#if onourowntime}",
    		ctx
    	});

    	return block;
    }

    // (562:3) {#if green}
    function create_if_block_131(ctx) {
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("GREEN");
    			br0 = element("br");
    			t1 = text("Towards a Guidebook");
    			br1 = element("br");
    			t2 = text("for Ecocritical Graphic Design");
    			add_location(br0, file$q, 561, 19, 30210);
    			add_location(br1, file$q, 561, 42, 30233);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_131.name,
    		type: "if",
    		source: "(562:3) {#if green}",
    		ctx
    	});

    	return block;
    }

    // (563:3) {#if viv}
    function create_if_block_130(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Vivienne Westwood by Tim Blanks");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_130.name,
    		type: "if",
    		source: "(563:3) {#if viv}",
    		ctx
    	});

    	return block;
    }

    // (564:3) {#if bread}
    function create_if_block_129(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Bread & Demonstrations");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_129.name,
    		type: "if",
    		source: "(564:3) {#if bread}",
    		ctx
    	});

    	return block;
    }

    // (565:3) {#if breadmag}
    function create_if_block_128(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("\"Let them eat Brioche\"");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_128.name,
    		type: "if",
    		source: "(565:3) {#if breadmag}",
    		ctx
    	});

    	return block;
    }

    // (566:3) {#if portfolioio}
    function create_if_block_127(ctx) {
    	let a;
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = text("Io Sivertsen");
    			br = element("br");
    			t1 = text("Portfolio Website");
    			add_location(br, file$q, 565, 82, 30491);
    			attr_dev(a, "href", "https://0i0i.github.io/");
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$q, 565, 20, 30429);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t0);
    			append_dev(a, br);
    			append_dev(a, t1);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_127.name,
    		type: "if",
    		source: "(566:3) {#if portfolioio}",
    		ctx
    	});

    	return block;
    }

    // (567:3) {#if typoposters}
    function create_if_block_126(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("10 typefaces");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_126.name,
    		type: "if",
    		source: "(567:3) {#if typoposters}",
    		ctx
    	});

    	return block;
    }

    // (568:3) {#if beauimg}
    function create_if_block_125(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("\"Beautiful image\"");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_125.name,
    		type: "if",
    		source: "(568:3) {#if beauimg}",
    		ctx
    	});

    	return block;
    }

    // (569:3) {#if secret}
    function create_if_block_124(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Secret book");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_124.name,
    		type: "if",
    		source: "(569:3) {#if secret}",
    		ctx
    	});

    	return block;
    }

    // (570:3) {#if sortedplastic}
    function create_if_block_123(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Where does our sorted plastic go?");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_123.name,
    		type: "if",
    		source: "(570:3) {#if sortedplastic}",
    		ctx
    	});

    	return block;
    }

    // (571:3) {#if oeb}
    function create_if_block_122(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("OEB");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_122.name,
    		type: "if",
    		source: "(571:3) {#if oeb}",
    		ctx
    	});

    	return block;
    }

    // (572:3) {#if musicposters}
    function create_if_block_121(ctx) {
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text("Four Corners /");
    			br0 = element("br");
    			t1 = text("Cause We've Ended As Lovers");
    			br1 = element("br");
    			t2 = text("/ Pinball");
    			add_location(br0, file$q, 571, 35, 30748);
    			add_location(br1, file$q, 571, 66, 30779);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_121.name,
    		type: "if",
    		source: "(572:3) {#if musicposters}",
    		ctx
    	});

    	return block;
    }

    // (573:3) {#if timatal}
    function create_if_block_120(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Tímatal");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_120.name,
    		type: "if",
    		source: "(573:3) {#if timatal}",
    		ctx
    	});

    	return block;
    }

    // (574:3) {#if tools}
    function create_if_block_119(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Tools of Expession");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_119.name,
    		type: "if",
    		source: "(574:3) {#if tools}",
    		ctx
    	});

    	return block;
    }

    // (575:3) {#if trash}
    function create_if_block_118(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A(nother) Drop in the Ocean");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_118.name,
    		type: "if",
    		source: "(575:3) {#if trash}",
    		ctx
    	});

    	return block;
    }

    // (576:3) {#if musicbook}
    function create_if_block_117(ctx) {
    	let t0;
    	let br0;
    	let t1;
    	let br1;
    	let t2;
    	let br2;
    	let t3;
    	let br3;
    	let t4;

    	const block = {
    		c: function create() {
    			t0 = text("Where we're from");
    			br0 = element("br");
    			t1 = text("the birds sing a");
    			br1 = element("br");
    			t2 = text("pretty song and");
    			br2 = element("br");
    			t3 = text("there's always music");
    			br3 = element("br");
    			t4 = text("in the air.");
    			add_location(br0, file$q, 575, 34, 30946);
    			add_location(br1, file$q, 575, 54, 30966);
    			add_location(br2, file$q, 575, 73, 30985);
    			add_location(br3, file$q, 575, 97, 31009);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, br3, anchor);
    			insert_dev(target, t4, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(br3);
    			if (detaching) detach_dev(t4);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_117.name,
    		type: "if",
    		source: "(576:3) {#if musicbook}",
    		ctx
    	});

    	return block;
    }

    // (577:3) {#if corruptedspace}
    function create_if_block_116(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Corrupted Space");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_116.name,
    		type: "if",
    		source: "(577:3) {#if corruptedspace}",
    		ctx
    	});

    	return block;
    }

    // (578:3) {#if oilbuddies}
    function create_if_block_115(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Bubble boys");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_115.name,
    		type: "if",
    		source: "(578:3) {#if oilbuddies}",
    		ctx
    	});

    	return block;
    }

    // (579:3) {#if litabok}
    function create_if_block_114(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("The Colorful Richness of Black and White");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_114.name,
    		type: "if",
    		source: "(579:3) {#if litabok}",
    		ctx
    	});

    	return block;
    }

    // (580:3) {#if plastica}
    function create_if_block_113(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Plastica");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_113.name,
    		type: "if",
    		source: "(580:3) {#if plastica}",
    		ctx
    	});

    	return block;
    }

    // (581:3) {#if familiarfaces}
    function create_if_block_112(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Familiar Faces");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_112.name,
    		type: "if",
    		source: "(581:3) {#if familiarfaces}",
    		ctx
    	});

    	return block;
    }

    // (582:3) {#if likamar}
    function create_if_block_111(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Untitled Typeface");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_111.name,
    		type: "if",
    		source: "(582:3) {#if likamar}",
    		ctx
    	});

    	return block;
    }

    // (583:3) {#if flora}
    function create_if_block_110(ctx) {
    	let a;

    	const block = {
    		c: function create() {
    			a = element("a");
    			a.textContent = "Flóra útgáfa";
    			attr_dev(a, "href", "https://flora-utgafa.is/");
    			set_style(a, "color", "lightblue", 1);
    			attr_dev(a, "target", "_blank");
    			add_location(a, file$q, 582, 14, 31298);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_110.name,
    		type: "if",
    		source: "(583:3) {#if flora}",
    		ctx
    	});

    	return block;
    }

    // (584:4) {#if evublad}
    function create_if_block_109(ctx) {
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("Artist Interview");
    			br = element("br");
    			t1 = text("Eva Sigurðardóttir");
    			add_location(br, file$q, 583, 33, 31441);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_109.name,
    		type: "if",
    		source: "(584:4) {#if evublad}",
    		ctx
    	});

    	return block;
    }

    // (585:4) {#if somalgors}
    function create_if_block_108(ctx) {
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("Internship at Somalgors74");
    			br = element("br");
    			t1 = text("with Curdin Tones");
    			add_location(br, file$q, 584, 44, 31513);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_108.name,
    		type: "if",
    		source: "(585:4) {#if somalgors}",
    		ctx
    	});

    	return block;
    }

    // (586:4) {#if organogram}
    function create_if_block_107(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Organogram");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_107.name,
    		type: "if",
    		source: "(586:4) {#if organogram}",
    		ctx
    	});

    	return block;
    }

    // (590:5) {#if frontscreen}
    function create_if_block_106(ctx) {
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("Welcome to my portfolio!");
    			br = element("br");
    			t1 = text("Browse through my projects on the right and click to see more details.");
    			add_location(br, file$q, 589, 46, 31716);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_106.name,
    		type: "if",
    		source: "(590:5) {#if frontscreen}",
    		ctx
    	});

    	return block;
    }

    // (591:2) {#if onourowntime}
    function create_if_block_105(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Fundraiser / Catalogue website for Graphic Design and Non Linear Narrative, The Royal Academy of Art in The Hague, graduation class of 2020. Website design and building collaboration with Trang Ha, identity designed by Zahari Dimitrov and Zuzanna Zgierska using typefaces by Edward Dżułaj and Nedislav Kamburov.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_105.name,
    		type: "if",
    		source: "(591:2) {#if onourowntime}",
    		ctx
    	});

    	return block;
    }

    // (593:4) {#if viv}
    function create_if_block_104(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A publication containing an interview with Vivienne Westwood by Tim Blanks (published in Interview Magazine, July 18, 2012) along with added content related to topics mentioned in the interview. Printed on A3 and folded into a a-bit-wider-than-A4 format.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_104.name,
    		type: "if",
    		source: "(593:4) {#if viv}",
    		ctx
    	});

    	return block;
    }

    // (594:4) {#if typoposters}
    function create_if_block_103(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("20 posters celebrating 10 different typefaces. Printed front and back on 10 A2-sized sheets, and folded into A4 for storage.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_103.name,
    		type: "if",
    		source: "(594:4) {#if typoposters}",
    		ctx
    	});

    	return block;
    }

    // (595:2) {#if secret}
    function create_if_block_102(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("An anonymous's secret, translated into a foldout A6-size hardcover book.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_102.name,
    		type: "if",
    		source: "(595:2) {#if secret}",
    		ctx
    	});

    	return block;
    }

    // (596:2) {#if tools}
    function create_if_block_101(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A publication holding an archive of different communication tools. A5-size.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_101.name,
    		type: "if",
    		source: "(596:2) {#if tools}",
    		ctx
    	});

    	return block;
    }

    // (597:2) {#if timatal}
    function create_if_block_100(ctx) {
    	let t0;
    	let br;
    	let t1;

    	const block = {
    		c: function create() {
    			t0 = text("A collection of different ideas and imaginations of time and time-keeping. A kind of non-calendar calendar.");
    			br = element("br");
    			t1 = text("Content gathered from a single book found in a library (and returned before I thought of doucumenting it (rookie mistake) so the source remains a mystery).");
    			add_location(br, file$q, 596, 122, 32931);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t1, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_100.name,
    		type: "if",
    		source: "(597:2) {#if timatal}",
    		ctx
    	});

    	return block;
    }

    // (598:2) {#if sortedplastic}
    function create_if_block_99(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A research project, collaboration with Louana Gentner, on where plastic — sorted by residents of the Hague and delivered to local bins to be recycled — ends up. An interesting disappointment, documented in an A3-size publication and an online tetris-style game.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_99.name,
    		type: "if",
    		source: "(598:2) {#if sortedplastic}",
    		ctx
    	});

    	return block;
    }

    // (599:2) {#if litabok}
    function create_if_block_98(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("An installation and publication.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_98.name,
    		type: "if",
    		source: "(599:2) {#if litabok}",
    		ctx
    	});

    	return block;
    }

    // (600:2) {#if oilbuddies}
    function create_if_block_97(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("The heads of the worlds biggest oil-companies in 2017.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_97.name,
    		type: "if",
    		source: "(600:2) {#if oilbuddies}",
    		ctx
    	});

    	return block;
    }

    // (601:2) {#if trash}
    function create_if_block_96(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A set of stickers for the trash-bins of KABK as a call for recycling. Typeface made out of KABK's logo.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_96.name,
    		type: "if",
    		source: "(601:2) {#if trash}",
    		ctx
    	});

    	return block;
    }

    // (602:4) {#if familiarfaces}
    function create_if_block_95(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Posters, digital and physical, made in collaboration with Seojeong Youn.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_95.name,
    		type: "if",
    		source: "(602:4) {#if familiarfaces}",
    		ctx
    	});

    	return block;
    }

    // (603:4) {#if musicbook}
    function create_if_block_94(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A publication and a video about music's effect on humans, as seen through Stevie Wonder's 'If It's Magic', Dorothy Ashby, David Lynch, Meditation, Mantras and Patterns.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_94.name,
    		type: "if",
    		source: "(603:4) {#if musicbook}",
    		ctx
    	});

    	return block;
    }

    // (604:4) {#if plastica}
    function create_if_block_93(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("A Website and A Chrome extension, where I recreated Google as Plastica. A merging of two (supposedly) integral parts of my life.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_93.name,
    		type: "if",
    		source: "(604:4) {#if plastica}",
    		ctx
    	});

    	return block;
    }

    // (605:4) {#if corruptedspace}
    function create_if_block_92(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Posters, digital and physical, for a lecture series organized by INSIDE Master Interior Architecture and IAFD.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_92.name,
    		type: "if",
    		source: "(605:4) {#if corruptedspace}",
    		ctx
    	});

    	return block;
    }

    // (611:4) {#if likamar}
    function create_if_block_91(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Typeface initially designed in 2019, refined for Flóra útgáfa in 2020.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_91.name,
    		type: "if",
    		source: "(611:4) {#if likamar}",
    		ctx
    	});

    	return block;
    }

    // (612:4) {#if green}
    function create_if_block_90(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Graphic Design Bachelor thesis from Royal Academy of Art, the Hague.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_90.name,
    		type: "if",
    		source: "(612:4) {#if green}",
    		ctx
    	});

    	return block;
    }

    // (613:6) {#if evublad}
    function create_if_block_89(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("Studio visit and interview with artist Eva Sigurðardóttir. Eva's handwriting is used to translate integral parts of the interview from Icelandic to English.");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_89.name,
    		type: "if",
    		source: "(613:6) {#if evublad}",
    		ctx
    	});

    	return block;
    }

    // (617:2) {#if onourowntime}
    function create_if_block_88(ctx) {
    	let current;
    	const onourowntime_1 = new Onourowntime({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(onourowntime_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(onourowntime_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(onourowntime_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(onourowntime_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(onourowntime_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_88.name,
    		type: "if",
    		source: "(617:2) {#if onourowntime}",
    		ctx
    	});

    	return block;
    }

    // (618:2) {#if green}
    function create_if_block_87(ctx) {
    	let current;
    	const green_1 = new Green({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(green_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(green_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(green_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(green_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(green_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_87.name,
    		type: "if",
    		source: "(618:2) {#if green}",
    		ctx
    	});

    	return block;
    }

    // (619:2) {#if viv}
    function create_if_block_86(ctx) {
    	let current;
    	const vivienne = new Vivienne({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(vivienne.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(vivienne, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(vivienne.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(vivienne.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(vivienne, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_86.name,
    		type: "if",
    		source: "(619:2) {#if viv}",
    		ctx
    	});

    	return block;
    }

    // (620:2) {#if portfolioio}
    function create_if_block_85(ctx) {
    	let current;
    	const portfolioio_1 = new Portfolioio({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(portfolioio_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(portfolioio_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(portfolioio_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(portfolioio_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(portfolioio_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_85.name,
    		type: "if",
    		source: "(620:2) {#if portfolioio}",
    		ctx
    	});

    	return block;
    }

    // (621:2) {#if typoposters}
    function create_if_block_84(ctx) {
    	let current;
    	const typoposters_1 = new Typoposters({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(typoposters_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(typoposters_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(typoposters_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(typoposters_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(typoposters_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_84.name,
    		type: "if",
    		source: "(621:2) {#if typoposters}",
    		ctx
    	});

    	return block;
    }

    // (622:2) {#if secret}
    function create_if_block_83(ctx) {
    	let current;
    	const secret_1 = new Secret({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(secret_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(secret_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(secret_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(secret_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(secret_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_83.name,
    		type: "if",
    		source: "(622:2) {#if secret}",
    		ctx
    	});

    	return block;
    }

    // (623:2) {#if sortedplastic}
    function create_if_block_82(ctx) {
    	let current;
    	const sortedplastic_1 = new Sorted_plastic({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(sortedplastic_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(sortedplastic_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(sortedplastic_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(sortedplastic_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(sortedplastic_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_82.name,
    		type: "if",
    		source: "(623:2) {#if sortedplastic}",
    		ctx
    	});

    	return block;
    }

    // (624:2) {#if musicposters}
    function create_if_block_81(ctx) {
    	let current;
    	const musicposters_1 = new Musicposters({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(musicposters_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(musicposters_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(musicposters_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(musicposters_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(musicposters_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_81.name,
    		type: "if",
    		source: "(624:2) {#if musicposters}",
    		ctx
    	});

    	return block;
    }

    // (625:2) {#if timatal}
    function create_if_block_80(ctx) {
    	let current;
    	const timatal_1 = new Timatal({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(timatal_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(timatal_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(timatal_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(timatal_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(timatal_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_80.name,
    		type: "if",
    		source: "(625:2) {#if timatal}",
    		ctx
    	});

    	return block;
    }

    // (626:2) {#if tools}
    function create_if_block_79(ctx) {
    	let current;
    	const toolsofexpression = new ToolsOfExpression({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(toolsofexpression.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(toolsofexpression, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(toolsofexpression.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(toolsofexpression.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(toolsofexpression, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_79.name,
    		type: "if",
    		source: "(626:2) {#if tools}",
    		ctx
    	});

    	return block;
    }

    // (627:2) {#if trash}
    function create_if_block_78(ctx) {
    	let current;
    	const trash_1 = new Trash({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(trash_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(trash_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(trash_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(trash_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(trash_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_78.name,
    		type: "if",
    		source: "(627:2) {#if trash}",
    		ctx
    	});

    	return block;
    }

    // (628:2) {#if musicbook}
    function create_if_block_77(ctx) {
    	let current;
    	const musicbook_1 = new MusicBook({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(musicbook_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(musicbook_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(musicbook_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(musicbook_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(musicbook_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_77.name,
    		type: "if",
    		source: "(628:2) {#if musicbook}",
    		ctx
    	});

    	return block;
    }

    // (629:2) {#if corruptedspace}
    function create_if_block_76(ctx) {
    	let current;
    	const corrupted = new Corrupted({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(corrupted.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(corrupted, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(corrupted.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(corrupted.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(corrupted, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_76.name,
    		type: "if",
    		source: "(629:2) {#if corruptedspace}",
    		ctx
    	});

    	return block;
    }

    // (630:2) {#if oilbuddies}
    function create_if_block_75(ctx) {
    	let current;
    	const oilbuddies_1 = new OilBuddies({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(oilbuddies_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(oilbuddies_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(oilbuddies_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(oilbuddies_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(oilbuddies_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_75.name,
    		type: "if",
    		source: "(630:2) {#if oilbuddies}",
    		ctx
    	});

    	return block;
    }

    // (631:2) {#if litabok}
    function create_if_block_74(ctx) {
    	let current;
    	const litabok_1 = new Litabok({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(litabok_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(litabok_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(litabok_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(litabok_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(litabok_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_74.name,
    		type: "if",
    		source: "(631:2) {#if litabok}",
    		ctx
    	});

    	return block;
    }

    // (632:2) {#if plastica}
    function create_if_block_73(ctx) {
    	let current;
    	const plastica_1 = new Plastica({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(plastica_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(plastica_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(plastica_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(plastica_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(plastica_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_73.name,
    		type: "if",
    		source: "(632:2) {#if plastica}",
    		ctx
    	});

    	return block;
    }

    // (633:2) {#if familiarfaces}
    function create_if_block_72(ctx) {
    	let current;
    	const familiarfaces_1 = new FamiliarFaces({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(familiarfaces_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(familiarfaces_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(familiarfaces_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(familiarfaces_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(familiarfaces_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_72.name,
    		type: "if",
    		source: "(633:2) {#if familiarfaces}",
    		ctx
    	});

    	return block;
    }

    // (634:2) {#if likamar}
    function create_if_block_71(ctx) {
    	let current;
    	const likamar_1 = new Likamar({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(likamar_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(likamar_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(likamar_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(likamar_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(likamar_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_71.name,
    		type: "if",
    		source: "(634:2) {#if likamar}",
    		ctx
    	});

    	return block;
    }

    // (635:2) {#if oeb}
    function create_if_block_70(ctx) {
    	let current;
    	const oeb_1 = new Oeb({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(oeb_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(oeb_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(oeb_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(oeb_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(oeb_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_70.name,
    		type: "if",
    		source: "(635:2) {#if oeb}",
    		ctx
    	});

    	return block;
    }

    // (636:2) {#if beauimg}
    function create_if_block_69(ctx) {
    	let current;
    	const beauimg_1 = new Beauimg({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(beauimg_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(beauimg_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(beauimg_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(beauimg_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(beauimg_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_69.name,
    		type: "if",
    		source: "(636:2) {#if beauimg}",
    		ctx
    	});

    	return block;
    }

    // (637:2) {#if bread}
    function create_if_block_68(ctx) {
    	let current;
    	const bread_1 = new Bread({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(bread_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(bread_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(bread_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(bread_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(bread_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_68.name,
    		type: "if",
    		source: "(637:2) {#if bread}",
    		ctx
    	});

    	return block;
    }

    // (638:2) {#if flora}
    function create_if_block_67(ctx) {
    	let current;
    	const flora_1 = new Flora({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(flora_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(flora_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(flora_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(flora_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(flora_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_67.name,
    		type: "if",
    		source: "(638:2) {#if flora}",
    		ctx
    	});

    	return block;
    }

    // (639:2) {#if breadmag}
    function create_if_block_66(ctx) {
    	let current;
    	const breadmag_1 = new Breadmag({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(breadmag_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(breadmag_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(breadmag_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(breadmag_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(breadmag_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_66.name,
    		type: "if",
    		source: "(639:2) {#if breadmag}",
    		ctx
    	});

    	return block;
    }

    // (640:2) {#if evublad}
    function create_if_block_65(ctx) {
    	let current;
    	const evublad_1 = new Evublad({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(evublad_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(evublad_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(evublad_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(evublad_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(evublad_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_65.name,
    		type: "if",
    		source: "(640:2) {#if evublad}",
    		ctx
    	});

    	return block;
    }

    // (641:2) {#if somalgors}
    function create_if_block_64(ctx) {
    	let current;
    	const somalgors_1 = new Somalgors({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(somalgors_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(somalgors_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(somalgors_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(somalgors_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(somalgors_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_64.name,
    		type: "if",
    		source: "(641:2) {#if somalgors}",
    		ctx
    	});

    	return block;
    }

    // (642:2) {#if organogram}
    function create_if_block_63(ctx) {
    	let current;
    	const organogram_1 = new Organogram({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(organogram_1.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(organogram_1, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(organogram_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(organogram_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(organogram_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_63.name,
    		type: "if",
    		source: "(642:2) {#if organogram}",
    		ctx
    	});

    	return block;
    }

    // (712:4) {#if PICflora}
    function create_if_block_62(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/flora/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 711, 18, 38534);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleflora*/ ctx[97], false, false, false),
    					listen_dev(img, "click", /*click_handler_1*/ ctx[121], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_62.name,
    		type: "if",
    		source: "(712:4) {#if PICflora}",
    		ctx
    	});

    	return block;
    }

    // (713:4) {#if PIConourowntime}
    function create_if_block_61(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/onourowntime/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 712, 25, 38684);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleonourowntime*/ ctx[79], false, false, false),
    					listen_dev(img, "click", /*click_handler_2*/ ctx[122], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_61.name,
    		type: "if",
    		source: "(713:4) {#if PIConourowntime}",
    		ctx
    	});

    	return block;
    }

    // (714:4) {#if PICgreen}
    function create_if_block_60(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/thesis/small.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 713, 18, 38841);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglegreen*/ ctx[80], false, false, false),
    					listen_dev(img, "click", /*click_handler_3*/ ctx[123], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_60.name,
    		type: "if",
    		source: "(714:4) {#if PICgreen}",
    		ctx
    	});

    	return block;
    }

    // (715:4) {#if PICviv}
    function create_if_block_59(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/viv/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 714, 16, 38983);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleviv*/ ctx[81], false, false, false),
    					listen_dev(img, "click", /*click_handler_4*/ ctx[124], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_59.name,
    		type: "if",
    		source: "(715:4) {#if PICviv}",
    		ctx
    	});

    	return block;
    }

    // (716:4) {#if PICbread}
    function create_if_block_58(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/bread/small.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 715, 18, 39122);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglebread*/ ctx[96], false, false, false),
    					listen_dev(img, "click", /*click_handler_5*/ ctx[125], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_58.name,
    		type: "if",
    		source: "(716:4) {#if PICbread}",
    		ctx
    	});

    	return block;
    }

    // (717:4) {#if PICbreadmag}
    function create_if_block_57(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/bread/breadmag.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 716, 21, 39268);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglebreadmag*/ ctx[98], false, false, false),
    					listen_dev(img, "click", /*click_handler_6*/ ctx[126], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_57.name,
    		type: "if",
    		source: "(717:4) {#if PICbreadmag}",
    		ctx
    	});

    	return block;
    }

    // (718:4) {#if PICportfolioio}
    function create_if_block_56(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/io/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 717, 24, 39423);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleportfolioio*/ ctx[82], false, false, false),
    					listen_dev(img, "click", /*click_handler_7*/ ctx[127], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_56.name,
    		type: "if",
    		source: "(718:4) {#if PICportfolioio}",
    		ctx
    	});

    	return block;
    }

    // (719:4) {#if PICbeauimg}
    function create_if_block_55(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/beauimg/small.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 718, 20, 39571);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglebeauimg*/ ctx[95], false, false, false),
    					listen_dev(img, "click", /*click_handler_8*/ ctx[128], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_55.name,
    		type: "if",
    		source: "(719:4) {#if PICbeauimg}",
    		ctx
    	});

    	return block;
    }

    // (720:4) {#if PICtypoposters}
    function create_if_block_54(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/typoPosters/3.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 719, 24, 39724);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggletypoposters*/ ctx[83], false, false, false),
    					listen_dev(img, "click", /*click_handler_9*/ ctx[129], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_54.name,
    		type: "if",
    		source: "(720:4) {#if PICtypoposters}",
    		ctx
    	});

    	return block;
    }

    // (722:4) {#if PICoeb}
    function create_if_block_53(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/oeb/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 721, 16, 40006);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleoeb*/ ctx[94], false, false, false),
    					listen_dev(img, "click", /*click_handler_10*/ ctx[130], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_53.name,
    		type: "if",
    		source: "(722:4) {#if PICoeb}",
    		ctx
    	});

    	return block;
    }

    // (723:4) {#if PICsortedplastic}
    function create_if_block_52(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/sortedPlastic/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 722, 26, 40153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglesortedplastic*/ ctx[84], false, false, false),
    					listen_dev(img, "click", /*click_handler_11*/ ctx[131], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_52.name,
    		type: "if",
    		source: "(723:4) {#if PICsortedplastic}",
    		ctx
    	});

    	return block;
    }

    // (724:4) {#if PICmusicposters}
    function create_if_block_51(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/musicPosters/small.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 723, 25, 40319);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglemusicposters*/ ctx[85], false, false, false),
    					listen_dev(img, "click", /*click_handler_12*/ ctx[132], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_51.name,
    		type: "if",
    		source: "(724:4) {#if PICmusicposters}",
    		ctx
    	});

    	return block;
    }

    // (725:4) {#if PICtimatal}
    function create_if_block_50(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/timatal/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 724, 20, 40478);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggletimatal*/ ctx[86], false, false, false),
    					listen_dev(img, "click", /*click_handler_13*/ ctx[133], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_50.name,
    		type: "if",
    		source: "(725:4) {#if PICtimatal}",
    		ctx
    	});

    	return block;
    }

    // (726:4) {#if PICtools}
    function create_if_block_49(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/tools/tools.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 725, 18, 40625);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggletools*/ ctx[87], false, false, false),
    					listen_dev(img, "click", /*click_handler_14*/ ctx[134], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_49.name,
    		type: "if",
    		source: "(726:4) {#if PICtools}",
    		ctx
    	});

    	return block;
    }

    // (727:4) {#if PICfamiliarfaces}
    function create_if_block_48(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/familiarfaces/small.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 726, 26, 40776);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglefamiliarfaces*/ ctx[91], false, false, false),
    					listen_dev(img, "click", /*click_handler_15*/ ctx[135], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_48.name,
    		type: "if",
    		source: "(727:4) {#if PICfamiliarfaces}",
    		ctx
    	});

    	return block;
    }

    // (732:3) {#if PICmusicbook}
    function create_if_block_47(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic mw-430px");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/musicBook/4.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 731, 21, 41338);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglemusicbook*/ ctx[89], false, false, false),
    					listen_dev(img, "click", /*click_handler_16*/ ctx[136], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_47.name,
    		type: "if",
    		source: "(732:3) {#if PICmusicbook}",
    		ctx
    	});

    	return block;
    }

    // (733:3) {#if PICcorruptedspace}
    function create_if_block_46(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/corruptedspace/smaller.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 732, 26, 41502);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglecorruptedspace*/ ctx[90], false, false, false),
    					listen_dev(img, "click", /*click_handler_17*/ ctx[137], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_46.name,
    		type: "if",
    		source: "(733:3) {#if PICcorruptedspace}",
    		ctx
    	});

    	return block;
    }

    // (734:4) {#if PICsomalgors}
    function create_if_block_45(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/somalgors74/vitrine.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 733, 22, 41669);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglesomalgors*/ ctx[100], false, false, false),
    					listen_dev(img, "click", /*click_handler_18*/ ctx[138], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_45.name,
    		type: "if",
    		source: "(734:4) {#if PICsomalgors}",
    		ctx
    	});

    	return block;
    }

    // (735:4) {#if PIClitabok}
    function create_if_block_44(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			set_style(img, "max-width", "230px");
    			if (img.src !== (img_src_value = "igms/litabok/skulpt25-small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 734, 20, 41826);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglelitabok*/ ctx[92], false, false, false),
    					listen_dev(img, "click", /*click_handler_19*/ ctx[139], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_44.name,
    		type: "if",
    		source: "(735:4) {#if PIClitabok}",
    		ctx
    	});

    	return block;
    }

    // (736:4) {#if PICevublad}
    function create_if_block_43(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/evublad/evublad-spreads0.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 735, 20, 42010);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleevublad*/ ctx[99], false, false, false),
    					listen_dev(img, "click", /*click_handler_20*/ ctx[140], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_43.name,
    		type: "if",
    		source: "(736:4) {#if PICevublad}",
    		ctx
    	});

    	return block;
    }

    // (742:4) {#if PICplastica}
    function create_if_block_42(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/plastica/small2.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 741, 21, 42630);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleplastica*/ ctx[88], false, false, false),
    					listen_dev(img, "click", /*click_handler_21*/ ctx[141], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_42.name,
    		type: "if",
    		source: "(742:4) {#if PICplastica}",
    		ctx
    	});

    	return block;
    }

    // (744:4) {#if PICorgano}
    function create_if_block_41(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/organo.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 743, 19, 42975);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*toggleorganogram*/ ctx[101], false, false, false),
    					listen_dev(img, "click", /*click_handler_22*/ ctx[142], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_41.name,
    		type: "if",
    		source: "(744:4) {#if PICorgano}",
    		ctx
    	});

    	return block;
    }

    // (745:4) {#if PIClikamar}
    function create_if_block_40(ctx) {
    	let img;
    	let img_src_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "smallPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/typedesign/small.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 744, 20, 43140);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(img, "click", /*togglelikamar*/ ctx[93], false, false, false),
    					listen_dev(img, "click", /*click_handler_23*/ ctx[143], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_40.name,
    		type: "if",
    		source: "(745:4) {#if PIClikamar}",
    		ctx
    	});

    	return block;
    }

    // (751:2) {#if other}
    function create_if_block(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let t22;
    	let t23;
    	let t24;
    	let t25;
    	let t26;
    	let t27;
    	let t28;
    	let t29;
    	let t30;
    	let t31;
    	let t32;
    	let t33;
    	let t34;
    	let t35;
    	let t36;
    	let t37;
    	let t38;
    	let br0;
    	let br1;
    	let br2;
    	let br3;
    	let br4;
    	let br5;
    	let if_block0 = /*PICgjafakort*/ ctx[53] && create_if_block_39(ctx);
    	let if_block1 = /*PICcalendarA*/ ctx[54] && create_if_block_38(ctx);
    	let if_block2 = /*PICcalendarB*/ ctx[55] && create_if_block_37(ctx);
    	let if_block3 = /*PICbeyond*/ ctx[57] && create_if_block_36(ctx);
    	let if_block4 = /*PICtoomuch*/ ctx[58] && create_if_block_35(ctx);
    	let if_block5 = /*PICproverb*/ ctx[59] && create_if_block_34(ctx);
    	let if_block6 = /*PICpsdmynd*/ ctx[60] && create_if_block_33(ctx);
    	let if_block7 = /*PICfloraA*/ ctx[61] && create_if_block_32(ctx);
    	let if_block8 = /*PICdrawing*/ ctx[71] && create_if_block_31(ctx);
    	let if_block9 = /*PICdrawing*/ ctx[71] && create_if_block_30(ctx);
    	let if_block10 = /*PICcali*/ ctx[62] && create_if_block_29(ctx);
    	let if_block11 = /*PICcali*/ ctx[62] && create_if_block_28(ctx);
    	let if_block12 = /*PICbaby*/ ctx[63] && create_if_block_27(ctx);
    	let if_block13 = /*PICfimma*/ ctx[64] && create_if_block_26(ctx);
    	let if_block14 = /*PICpuppy*/ ctx[66] && create_if_block_25(ctx);
    	let if_block15 = /*PICtypobook*/ ctx[67] && create_if_block_24(ctx);
    	let if_block16 = /*PICbuyt*/ ctx[68] && create_if_block_23(ctx);
    	let if_block17 = /*PICdrawing*/ ctx[71] && create_if_block_22(ctx);
    	let if_block18 = /*PICdrawing*/ ctx[71] && create_if_block_21(ctx);
    	let if_block19 = /*PICleturgif*/ ctx[65] && create_if_block_20(ctx);
    	let if_block20 = /*PICflottabok*/ ctx[69] && create_if_block_19(ctx);
    	let if_block21 = /*PICtypobook*/ ctx[67] && create_if_block_18(ctx);
    	let if_block22 = /*PICtypobook*/ ctx[67] && create_if_block_17(ctx);
    	let if_block23 = /*PICtypobook*/ ctx[67] && create_if_block_16(ctx);
    	let if_block24 = /*PICegoposter*/ ctx[70] && create_if_block_15(ctx);
    	let if_block25 = /*PICdrawing*/ ctx[71] && create_if_block_14(ctx);
    	let if_block26 = /*PICdrawing*/ ctx[71] && create_if_block_13(ctx);
    	let if_block27 = /*PICdrawing*/ ctx[71] && create_if_block_12(ctx);
    	let if_block28 = /*PICalltmitt*/ ctx[76] && create_if_block_11(ctx);
    	let if_block29 = /*PICpsdmynd*/ ctx[60] && create_if_block_10(ctx);
    	let if_block30 = /*PICtrash*/ ctx[38] && create_if_block_9(ctx);
    	let if_block31 = /*PICsecret*/ ctx[32] && create_if_block_8(ctx);
    	let if_block32 = /*PICbritney*/ ctx[72] && create_if_block_7(ctx);
    	let if_block33 = /*PICpsycho*/ ctx[77] && create_if_block_6(ctx);
    	let if_block34 = /*PICbrandalism*/ ctx[73] && create_if_block_5(ctx);
    	let if_block35 = /*PICbrandalism*/ ctx[73] && create_if_block_4(ctx);
    	let if_block36 = /*PICegobook*/ ctx[74] && create_if_block_3(ctx);
    	let if_block37 = /*PICmen*/ ctx[75] && create_if_block_2(ctx);
    	let if_block38 = /*PICoilbuddies*/ ctx[41] && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			t3 = space();
    			if (if_block4) if_block4.c();
    			t4 = space();
    			if (if_block5) if_block5.c();
    			t5 = space();
    			if (if_block6) if_block6.c();
    			t6 = space();
    			if (if_block7) if_block7.c();
    			t7 = space();
    			if (if_block8) if_block8.c();
    			t8 = space();
    			if (if_block9) if_block9.c();
    			t9 = space();
    			if (if_block10) if_block10.c();
    			t10 = space();
    			if (if_block11) if_block11.c();
    			t11 = space();
    			if (if_block12) if_block12.c();
    			t12 = space();
    			if (if_block13) if_block13.c();
    			t13 = space();
    			if (if_block14) if_block14.c();
    			t14 = space();
    			if (if_block15) if_block15.c();
    			t15 = space();
    			if (if_block16) if_block16.c();
    			t16 = space();
    			if (if_block17) if_block17.c();
    			t17 = space();
    			if (if_block18) if_block18.c();
    			t18 = space();
    			if (if_block19) if_block19.c();
    			t19 = space();
    			if (if_block20) if_block20.c();
    			t20 = space();
    			if (if_block21) if_block21.c();
    			t21 = space();
    			if (if_block22) if_block22.c();
    			t22 = space();
    			if (if_block23) if_block23.c();
    			t23 = space();
    			if (if_block24) if_block24.c();
    			t24 = space();
    			if (if_block25) if_block25.c();
    			t25 = space();
    			if (if_block26) if_block26.c();
    			t26 = space();
    			if (if_block27) if_block27.c();
    			t27 = space();
    			if (if_block28) if_block28.c();
    			t28 = space();
    			if (if_block29) if_block29.c();
    			t29 = space();
    			if (if_block30) if_block30.c();
    			t30 = space();
    			if (if_block31) if_block31.c();
    			t31 = space();
    			if (if_block32) if_block32.c();
    			t32 = space();
    			if (if_block33) if_block33.c();
    			t33 = space();
    			if (if_block34) if_block34.c();
    			t34 = space();
    			if (if_block35) if_block35.c();
    			t35 = space();
    			if (if_block36) if_block36.c();
    			t36 = space();
    			if (if_block37) if_block37.c();
    			t37 = space();
    			if (if_block38) if_block38.c();
    			t38 = space();
    			br0 = element("br");
    			br1 = element("br");
    			br2 = element("br");
    			br3 = element("br");
    			br4 = element("br");
    			br5 = element("br");
    			add_location(br0, file$q, 828, 6, 51169);
    			add_location(br1, file$q, 828, 10, 51173);
    			add_location(br2, file$q, 828, 14, 51177);
    			add_location(br3, file$q, 828, 18, 51181);
    			add_location(br4, file$q, 828, 22, 51185);
    			add_location(br5, file$q, 828, 26, 51189);
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block4) if_block4.m(target, anchor);
    			insert_dev(target, t4, anchor);
    			if (if_block5) if_block5.m(target, anchor);
    			insert_dev(target, t5, anchor);
    			if (if_block6) if_block6.m(target, anchor);
    			insert_dev(target, t6, anchor);
    			if (if_block7) if_block7.m(target, anchor);
    			insert_dev(target, t7, anchor);
    			if (if_block8) if_block8.m(target, anchor);
    			insert_dev(target, t8, anchor);
    			if (if_block9) if_block9.m(target, anchor);
    			insert_dev(target, t9, anchor);
    			if (if_block10) if_block10.m(target, anchor);
    			insert_dev(target, t10, anchor);
    			if (if_block11) if_block11.m(target, anchor);
    			insert_dev(target, t11, anchor);
    			if (if_block12) if_block12.m(target, anchor);
    			insert_dev(target, t12, anchor);
    			if (if_block13) if_block13.m(target, anchor);
    			insert_dev(target, t13, anchor);
    			if (if_block14) if_block14.m(target, anchor);
    			insert_dev(target, t14, anchor);
    			if (if_block15) if_block15.m(target, anchor);
    			insert_dev(target, t15, anchor);
    			if (if_block16) if_block16.m(target, anchor);
    			insert_dev(target, t16, anchor);
    			if (if_block17) if_block17.m(target, anchor);
    			insert_dev(target, t17, anchor);
    			if (if_block18) if_block18.m(target, anchor);
    			insert_dev(target, t18, anchor);
    			if (if_block19) if_block19.m(target, anchor);
    			insert_dev(target, t19, anchor);
    			if (if_block20) if_block20.m(target, anchor);
    			insert_dev(target, t20, anchor);
    			if (if_block21) if_block21.m(target, anchor);
    			insert_dev(target, t21, anchor);
    			if (if_block22) if_block22.m(target, anchor);
    			insert_dev(target, t22, anchor);
    			if (if_block23) if_block23.m(target, anchor);
    			insert_dev(target, t23, anchor);
    			if (if_block24) if_block24.m(target, anchor);
    			insert_dev(target, t24, anchor);
    			if (if_block25) if_block25.m(target, anchor);
    			insert_dev(target, t25, anchor);
    			if (if_block26) if_block26.m(target, anchor);
    			insert_dev(target, t26, anchor);
    			if (if_block27) if_block27.m(target, anchor);
    			insert_dev(target, t27, anchor);
    			if (if_block28) if_block28.m(target, anchor);
    			insert_dev(target, t28, anchor);
    			if (if_block29) if_block29.m(target, anchor);
    			insert_dev(target, t29, anchor);
    			if (if_block30) if_block30.m(target, anchor);
    			insert_dev(target, t30, anchor);
    			if (if_block31) if_block31.m(target, anchor);
    			insert_dev(target, t31, anchor);
    			if (if_block32) if_block32.m(target, anchor);
    			insert_dev(target, t32, anchor);
    			if (if_block33) if_block33.m(target, anchor);
    			insert_dev(target, t33, anchor);
    			if (if_block34) if_block34.m(target, anchor);
    			insert_dev(target, t34, anchor);
    			if (if_block35) if_block35.m(target, anchor);
    			insert_dev(target, t35, anchor);
    			if (if_block36) if_block36.m(target, anchor);
    			insert_dev(target, t36, anchor);
    			if (if_block37) if_block37.m(target, anchor);
    			insert_dev(target, t37, anchor);
    			if (if_block38) if_block38.m(target, anchor);
    			insert_dev(target, t38, anchor);
    			insert_dev(target, br0, anchor);
    			insert_dev(target, br1, anchor);
    			insert_dev(target, br2, anchor);
    			insert_dev(target, br3, anchor);
    			insert_dev(target, br4, anchor);
    			insert_dev(target, br5, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*PICgjafakort*/ ctx[53]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_39(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*PICcalendarA*/ ctx[54]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_38(ctx);
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*PICcalendarB*/ ctx[55]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_37(ctx);
    					if_block2.c();
    					if_block2.m(t2.parentNode, t2);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*PICbeyond*/ ctx[57]) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_36(ctx);
    					if_block3.c();
    					if_block3.m(t3.parentNode, t3);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*PICtoomuch*/ ctx[58]) {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_35(ctx);
    					if_block4.c();
    					if_block4.m(t4.parentNode, t4);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*PICproverb*/ ctx[59]) {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_34(ctx);
    					if_block5.c();
    					if_block5.m(t5.parentNode, t5);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*PICpsdmynd*/ ctx[60]) {
    				if (if_block6) ; else {
    					if_block6 = create_if_block_33(ctx);
    					if_block6.c();
    					if_block6.m(t6.parentNode, t6);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (/*PICfloraA*/ ctx[61]) {
    				if (if_block7) ; else {
    					if_block7 = create_if_block_32(ctx);
    					if_block7.c();
    					if_block7.m(t7.parentNode, t7);
    				}
    			} else if (if_block7) {
    				if_block7.d(1);
    				if_block7 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block8) ; else {
    					if_block8 = create_if_block_31(ctx);
    					if_block8.c();
    					if_block8.m(t8.parentNode, t8);
    				}
    			} else if (if_block8) {
    				if_block8.d(1);
    				if_block8 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block9) ; else {
    					if_block9 = create_if_block_30(ctx);
    					if_block9.c();
    					if_block9.m(t9.parentNode, t9);
    				}
    			} else if (if_block9) {
    				if_block9.d(1);
    				if_block9 = null;
    			}

    			if (/*PICcali*/ ctx[62]) {
    				if (if_block10) ; else {
    					if_block10 = create_if_block_29(ctx);
    					if_block10.c();
    					if_block10.m(t10.parentNode, t10);
    				}
    			} else if (if_block10) {
    				if_block10.d(1);
    				if_block10 = null;
    			}

    			if (/*PICcali*/ ctx[62]) {
    				if (if_block11) ; else {
    					if_block11 = create_if_block_28(ctx);
    					if_block11.c();
    					if_block11.m(t11.parentNode, t11);
    				}
    			} else if (if_block11) {
    				if_block11.d(1);
    				if_block11 = null;
    			}

    			if (/*PICbaby*/ ctx[63]) {
    				if (if_block12) ; else {
    					if_block12 = create_if_block_27(ctx);
    					if_block12.c();
    					if_block12.m(t12.parentNode, t12);
    				}
    			} else if (if_block12) {
    				if_block12.d(1);
    				if_block12 = null;
    			}

    			if (/*PICfimma*/ ctx[64]) {
    				if (if_block13) ; else {
    					if_block13 = create_if_block_26(ctx);
    					if_block13.c();
    					if_block13.m(t13.parentNode, t13);
    				}
    			} else if (if_block13) {
    				if_block13.d(1);
    				if_block13 = null;
    			}

    			if (/*PICpuppy*/ ctx[66]) {
    				if (if_block14) ; else {
    					if_block14 = create_if_block_25(ctx);
    					if_block14.c();
    					if_block14.m(t14.parentNode, t14);
    				}
    			} else if (if_block14) {
    				if_block14.d(1);
    				if_block14 = null;
    			}

    			if (/*PICtypobook*/ ctx[67]) {
    				if (if_block15) ; else {
    					if_block15 = create_if_block_24(ctx);
    					if_block15.c();
    					if_block15.m(t15.parentNode, t15);
    				}
    			} else if (if_block15) {
    				if_block15.d(1);
    				if_block15 = null;
    			}

    			if (/*PICbuyt*/ ctx[68]) {
    				if (if_block16) ; else {
    					if_block16 = create_if_block_23(ctx);
    					if_block16.c();
    					if_block16.m(t16.parentNode, t16);
    				}
    			} else if (if_block16) {
    				if_block16.d(1);
    				if_block16 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block17) ; else {
    					if_block17 = create_if_block_22(ctx);
    					if_block17.c();
    					if_block17.m(t17.parentNode, t17);
    				}
    			} else if (if_block17) {
    				if_block17.d(1);
    				if_block17 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block18) ; else {
    					if_block18 = create_if_block_21(ctx);
    					if_block18.c();
    					if_block18.m(t18.parentNode, t18);
    				}
    			} else if (if_block18) {
    				if_block18.d(1);
    				if_block18 = null;
    			}

    			if (/*PICleturgif*/ ctx[65]) {
    				if (if_block19) ; else {
    					if_block19 = create_if_block_20(ctx);
    					if_block19.c();
    					if_block19.m(t19.parentNode, t19);
    				}
    			} else if (if_block19) {
    				if_block19.d(1);
    				if_block19 = null;
    			}

    			if (/*PICflottabok*/ ctx[69]) {
    				if (if_block20) ; else {
    					if_block20 = create_if_block_19(ctx);
    					if_block20.c();
    					if_block20.m(t20.parentNode, t20);
    				}
    			} else if (if_block20) {
    				if_block20.d(1);
    				if_block20 = null;
    			}

    			if (/*PICtypobook*/ ctx[67]) {
    				if (if_block21) ; else {
    					if_block21 = create_if_block_18(ctx);
    					if_block21.c();
    					if_block21.m(t21.parentNode, t21);
    				}
    			} else if (if_block21) {
    				if_block21.d(1);
    				if_block21 = null;
    			}

    			if (/*PICtypobook*/ ctx[67]) {
    				if (if_block22) ; else {
    					if_block22 = create_if_block_17(ctx);
    					if_block22.c();
    					if_block22.m(t22.parentNode, t22);
    				}
    			} else if (if_block22) {
    				if_block22.d(1);
    				if_block22 = null;
    			}

    			if (/*PICtypobook*/ ctx[67]) {
    				if (if_block23) ; else {
    					if_block23 = create_if_block_16(ctx);
    					if_block23.c();
    					if_block23.m(t23.parentNode, t23);
    				}
    			} else if (if_block23) {
    				if_block23.d(1);
    				if_block23 = null;
    			}

    			if (/*PICegoposter*/ ctx[70]) {
    				if (if_block24) ; else {
    					if_block24 = create_if_block_15(ctx);
    					if_block24.c();
    					if_block24.m(t24.parentNode, t24);
    				}
    			} else if (if_block24) {
    				if_block24.d(1);
    				if_block24 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block25) ; else {
    					if_block25 = create_if_block_14(ctx);
    					if_block25.c();
    					if_block25.m(t25.parentNode, t25);
    				}
    			} else if (if_block25) {
    				if_block25.d(1);
    				if_block25 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block26) ; else {
    					if_block26 = create_if_block_13(ctx);
    					if_block26.c();
    					if_block26.m(t26.parentNode, t26);
    				}
    			} else if (if_block26) {
    				if_block26.d(1);
    				if_block26 = null;
    			}

    			if (/*PICdrawing*/ ctx[71]) {
    				if (if_block27) ; else {
    					if_block27 = create_if_block_12(ctx);
    					if_block27.c();
    					if_block27.m(t27.parentNode, t27);
    				}
    			} else if (if_block27) {
    				if_block27.d(1);
    				if_block27 = null;
    			}

    			if (/*PICalltmitt*/ ctx[76]) {
    				if (if_block28) ; else {
    					if_block28 = create_if_block_11(ctx);
    					if_block28.c();
    					if_block28.m(t28.parentNode, t28);
    				}
    			} else if (if_block28) {
    				if_block28.d(1);
    				if_block28 = null;
    			}

    			if (/*PICpsdmynd*/ ctx[60]) {
    				if (if_block29) ; else {
    					if_block29 = create_if_block_10(ctx);
    					if_block29.c();
    					if_block29.m(t29.parentNode, t29);
    				}
    			} else if (if_block29) {
    				if_block29.d(1);
    				if_block29 = null;
    			}

    			if (/*PICtrash*/ ctx[38]) {
    				if (if_block30) ; else {
    					if_block30 = create_if_block_9(ctx);
    					if_block30.c();
    					if_block30.m(t30.parentNode, t30);
    				}
    			} else if (if_block30) {
    				if_block30.d(1);
    				if_block30 = null;
    			}

    			if (/*PICsecret*/ ctx[32]) {
    				if (if_block31) ; else {
    					if_block31 = create_if_block_8(ctx);
    					if_block31.c();
    					if_block31.m(t31.parentNode, t31);
    				}
    			} else if (if_block31) {
    				if_block31.d(1);
    				if_block31 = null;
    			}

    			if (/*PICbritney*/ ctx[72]) {
    				if (if_block32) ; else {
    					if_block32 = create_if_block_7(ctx);
    					if_block32.c();
    					if_block32.m(t32.parentNode, t32);
    				}
    			} else if (if_block32) {
    				if_block32.d(1);
    				if_block32 = null;
    			}

    			if (/*PICpsycho*/ ctx[77]) {
    				if (if_block33) ; else {
    					if_block33 = create_if_block_6(ctx);
    					if_block33.c();
    					if_block33.m(t33.parentNode, t33);
    				}
    			} else if (if_block33) {
    				if_block33.d(1);
    				if_block33 = null;
    			}

    			if (/*PICbrandalism*/ ctx[73]) {
    				if (if_block34) ; else {
    					if_block34 = create_if_block_5(ctx);
    					if_block34.c();
    					if_block34.m(t34.parentNode, t34);
    				}
    			} else if (if_block34) {
    				if_block34.d(1);
    				if_block34 = null;
    			}

    			if (/*PICbrandalism*/ ctx[73]) {
    				if (if_block35) ; else {
    					if_block35 = create_if_block_4(ctx);
    					if_block35.c();
    					if_block35.m(t35.parentNode, t35);
    				}
    			} else if (if_block35) {
    				if_block35.d(1);
    				if_block35 = null;
    			}

    			if (/*PICegobook*/ ctx[74]) {
    				if (if_block36) ; else {
    					if_block36 = create_if_block_3(ctx);
    					if_block36.c();
    					if_block36.m(t36.parentNode, t36);
    				}
    			} else if (if_block36) {
    				if_block36.d(1);
    				if_block36 = null;
    			}

    			if (/*PICmen*/ ctx[75]) {
    				if (if_block37) ; else {
    					if_block37 = create_if_block_2(ctx);
    					if_block37.c();
    					if_block37.m(t37.parentNode, t37);
    				}
    			} else if (if_block37) {
    				if_block37.d(1);
    				if_block37 = null;
    			}

    			if (/*PICoilbuddies*/ ctx[41]) {
    				if (if_block38) ; else {
    					if_block38 = create_if_block_1(ctx);
    					if_block38.c();
    					if_block38.m(t38.parentNode, t38);
    				}
    			} else if (if_block38) {
    				if_block38.d(1);
    				if_block38 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(t3);
    			if (if_block4) if_block4.d(detaching);
    			if (detaching) detach_dev(t4);
    			if (if_block5) if_block5.d(detaching);
    			if (detaching) detach_dev(t5);
    			if (if_block6) if_block6.d(detaching);
    			if (detaching) detach_dev(t6);
    			if (if_block7) if_block7.d(detaching);
    			if (detaching) detach_dev(t7);
    			if (if_block8) if_block8.d(detaching);
    			if (detaching) detach_dev(t8);
    			if (if_block9) if_block9.d(detaching);
    			if (detaching) detach_dev(t9);
    			if (if_block10) if_block10.d(detaching);
    			if (detaching) detach_dev(t10);
    			if (if_block11) if_block11.d(detaching);
    			if (detaching) detach_dev(t11);
    			if (if_block12) if_block12.d(detaching);
    			if (detaching) detach_dev(t12);
    			if (if_block13) if_block13.d(detaching);
    			if (detaching) detach_dev(t13);
    			if (if_block14) if_block14.d(detaching);
    			if (detaching) detach_dev(t14);
    			if (if_block15) if_block15.d(detaching);
    			if (detaching) detach_dev(t15);
    			if (if_block16) if_block16.d(detaching);
    			if (detaching) detach_dev(t16);
    			if (if_block17) if_block17.d(detaching);
    			if (detaching) detach_dev(t17);
    			if (if_block18) if_block18.d(detaching);
    			if (detaching) detach_dev(t18);
    			if (if_block19) if_block19.d(detaching);
    			if (detaching) detach_dev(t19);
    			if (if_block20) if_block20.d(detaching);
    			if (detaching) detach_dev(t20);
    			if (if_block21) if_block21.d(detaching);
    			if (detaching) detach_dev(t21);
    			if (if_block22) if_block22.d(detaching);
    			if (detaching) detach_dev(t22);
    			if (if_block23) if_block23.d(detaching);
    			if (detaching) detach_dev(t23);
    			if (if_block24) if_block24.d(detaching);
    			if (detaching) detach_dev(t24);
    			if (if_block25) if_block25.d(detaching);
    			if (detaching) detach_dev(t25);
    			if (if_block26) if_block26.d(detaching);
    			if (detaching) detach_dev(t26);
    			if (if_block27) if_block27.d(detaching);
    			if (detaching) detach_dev(t27);
    			if (if_block28) if_block28.d(detaching);
    			if (detaching) detach_dev(t28);
    			if (if_block29) if_block29.d(detaching);
    			if (detaching) detach_dev(t29);
    			if (if_block30) if_block30.d(detaching);
    			if (detaching) detach_dev(t30);
    			if (if_block31) if_block31.d(detaching);
    			if (detaching) detach_dev(t31);
    			if (if_block32) if_block32.d(detaching);
    			if (detaching) detach_dev(t32);
    			if (if_block33) if_block33.d(detaching);
    			if (detaching) detach_dev(t33);
    			if (if_block34) if_block34.d(detaching);
    			if (detaching) detach_dev(t34);
    			if (if_block35) if_block35.d(detaching);
    			if (detaching) detach_dev(t35);
    			if (if_block36) if_block36.d(detaching);
    			if (detaching) detach_dev(t36);
    			if (if_block37) if_block37.d(detaching);
    			if (detaching) detach_dev(t37);
    			if (if_block38) if_block38.d(detaching);
    			if (detaching) detach_dev(t38);
    			if (detaching) detach_dev(br0);
    			if (detaching) detach_dev(br1);
    			if (detaching) detach_dev(br2);
    			if (detaching) detach_dev(br3);
    			if (detaching) detach_dev(br4);
    			if (detaching) detach_dev(br5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(751:2) {#if other}",
    		ctx
    	});

    	return block;
    }

    // (753:5) {#if PICgjafakort}
    function create_if_block_39(ctx) {
    	let img0;
    	let img0_src_value;
    	let img1;
    	let img1_src_value;
    	let img2;
    	let img2_src_value;

    	const block = {
    		c: function create() {
    			img0 = element("img");
    			img1 = element("img");
    			img2 = element("img");
    			attr_dev(img0, "class", "mediumPic");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/kaffivest/gjafakort2.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$q, 752, 23, 43429);
    			attr_dev(img1, "class", "mediumPic");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/kaffivest/gjafakort.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$q, 752, 93, 43499);
    			attr_dev(img2, "class", "mediumPic");
    			attr_dev(img2, "alt", "mynd");
    			if (img2.src !== (img2_src_value = "igms/kaffivest/3D.png")) attr_dev(img2, "src", img2_src_value);
    			add_location(img2, file$q, 752, 162, 43568);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img0, anchor);
    			insert_dev(target, img1, anchor);
    			insert_dev(target, img2, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img0);
    			if (detaching) detach_dev(img1);
    			if (detaching) detach_dev(img2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_39.name,
    		type: "if",
    		source: "(753:5) {#if PICgjafakort}",
    		ctx
    	});

    	return block;
    }

    // (754:5) {#if PICcalendarA}
    function create_if_block_38(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-teikningar/ulines.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 753, 23, 43659);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_38.name,
    		type: "if",
    		source: "(754:5) {#if PICcalendarA}",
    		ctx
    	});

    	return block;
    }

    // (755:5) {#if PICcalendarB}
    function create_if_block_37(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-teikningar/upprodun3rettmeddrasli2.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 754, 23, 43765);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_37.name,
    		type: "if",
    		source: "(755:5) {#if PICcalendarB}",
    		ctx
    	});

    	return block;
    }

    // (756:5) {#if PICbeyond}
    function create_if_block_36(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-posters/2.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 755, 20, 43885);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_36.name,
    		type: "if",
    		source: "(756:5) {#if PICbeyond}",
    		ctx
    	});

    	return block;
    }

    // (757:5) {#if PICtoomuch}
    function create_if_block_35(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/toomuchtoseelevel.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 756, 21, 43981);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_35.name,
    		type: "if",
    		source: "(757:5) {#if PICtoomuch}",
    		ctx
    	});

    	return block;
    }

    // (758:5) {#if PICproverb}
    function create_if_block_34(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/aproverb.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 757, 21, 44095);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_34.name,
    		type: "if",
    		source: "(758:5) {#if PICproverb}",
    		ctx
    	});

    	return block;
    }

    // (762:5) {#if PICpsdmynd}
    function create_if_block_33(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/blubb_Page_14b.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 761, 21, 44475);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_33.name,
    		type: "if",
    		source: "(762:5) {#if PICpsdmynd}",
    		ctx
    	});

    	return block;
    }

    // (765:5) {#if PICfloraA}
    function create_if_block_32(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/5utgafa-ut.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 764, 20, 44777);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_32.name,
    		type: "if",
    		source: "(765:5) {#if PICfloraA}",
    		ctx
    	});

    	return block;
    }

    // (766:6) {#if PICdrawing}
    function create_if_block_31(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/heyasinhot.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 765, 22, 44885);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_31.name,
    		type: "if",
    		source: "(766:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (767:6) {#if PICdrawing}
    function create_if_block_30(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/rug3.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 766, 22, 44993);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_30.name,
    		type: "if",
    		source: "(767:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (772:5) {#if PICcali}
    function create_if_block_29(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/cali/cali1.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 771, 18, 45456);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_29.name,
    		type: "if",
    		source: "(772:5) {#if PICcali}",
    		ctx
    	});

    	return block;
    }

    // (774:5) {#if PICcali}
    function create_if_block_28(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/cali/cali3.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 773, 18, 45624);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_28.name,
    		type: "if",
    		source: "(774:5) {#if PICcali}",
    		ctx
    	});

    	return block;
    }

    // (776:5) {#if PICbaby}
    function create_if_block_27(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/smallbaby.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 775, 18, 45781);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_27.name,
    		type: "if",
    		source: "(776:5) {#if PICbaby}",
    		ctx
    	});

    	return block;
    }

    // (777:5) {#if PICfimma}
    function create_if_block_26(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/5red1.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 776, 19, 45885);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_26.name,
    		type: "if",
    		source: "(777:5) {#if PICfimma}",
    		ctx
    	});

    	return block;
    }

    // (781:5) {#if PICpuppy}
    function create_if_block_25(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			set_style(img, "max-width", "30vw");
    			if (img.src !== (img_src_value = "igms/undefined-posters/KABKPuppyParade2.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 780, 19, 46289);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_25.name,
    		type: "if",
    		source: "(781:5) {#if PICpuppy}",
    		ctx
    	});

    	return block;
    }

    // (782:6) {#if PICtypobook}
    function create_if_block_24(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/typography.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 781, 23, 46427);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_24.name,
    		type: "if",
    		source: "(782:6) {#if PICtypobook}",
    		ctx
    	});

    	return block;
    }

    // (785:6) {#if PICbuyt}
    function create_if_block_23(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/5web.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 784, 19, 46711);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_23.name,
    		type: "if",
    		source: "(785:6) {#if PICbuyt}",
    		ctx
    	});

    	return block;
    }

    // (787:6) {#if PICdrawing}
    function create_if_block_22(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/platti1.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 786, 22, 46926);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_22.name,
    		type: "if",
    		source: "(787:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (788:6) {#if PICdrawing}
    function create_if_block_21(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/platti3.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 787, 22, 47031);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_21.name,
    		type: "if",
    		source: "(788:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (795:5) {#if PICleturgif}
    function create_if_block_20(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/oohnoo.gif")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 794, 22, 47925);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_20.name,
    		type: "if",
    		source: "(795:5) {#if PICleturgif}",
    		ctx
    	});

    	return block;
    }

    // (796:5) {#if PICflottabok}
    function create_if_block_19(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/front.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 795, 23, 48030);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_19.name,
    		type: "if",
    		source: "(796:5) {#if PICflottabok}",
    		ctx
    	});

    	return block;
    }

    // (798:6) {#if PICtypobook}
    function create_if_block_18(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/display1.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 797, 23, 48232);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_18.name,
    		type: "if",
    		source: "(798:6) {#if PICtypobook}",
    		ctx
    	});

    	return block;
    }

    // (799:6) {#if PICtypobook}
    function create_if_block_17(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/display2.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 798, 23, 48339);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_17.name,
    		type: "if",
    		source: "(799:6) {#if PICtypobook}",
    		ctx
    	});

    	return block;
    }

    // (800:6) {#if PICtypobook}
    function create_if_block_16(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/display3.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 799, 23, 48446);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_16.name,
    		type: "if",
    		source: "(800:6) {#if PICtypobook}",
    		ctx
    	});

    	return block;
    }

    // (807:6) {#if PICegoposter}
    function create_if_block_15(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-posters/otherPoster.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 806, 24, 49165);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_15.name,
    		type: "if",
    		source: "(807:6) {#if PICegoposter}",
    		ctx
    	});

    	return block;
    }

    // (808:6) {#if PICdrawing}
    function create_if_block_14(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-teikningar/teikning1.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 807, 22, 49272);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_14.name,
    		type: "if",
    		source: "(808:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (809:6) {#if PICdrawing}
    function create_if_block_13(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-teikningar/teikning2.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 808, 22, 49380);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_13.name,
    		type: "if",
    		source: "(809:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (810:6) {#if PICdrawing}
    function create_if_block_12(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-teikningar/teikning3.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 809, 22, 49488);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_12.name,
    		type: "if",
    		source: "(810:6) {#if PICdrawing}",
    		ctx
    	});

    	return block;
    }

    // (811:6) {#if PICalltmitt}
    function create_if_block_11(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/alltmitt/1.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 810, 23, 49597);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_11.name,
    		type: "if",
    		source: "(811:6) {#if PICalltmitt}",
    		ctx
    	});

    	return block;
    }

    // (812:6) {#if PICpsdmynd}
    function create_if_block_10(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			set_style(img, "border-radius", "120px");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/_.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 811, 22, 49685);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(812:6) {#if PICpsdmynd}",
    		ctx
    	});

    	return block;
    }

    // (813:6) {#if PICtrash}
    function create_if_block_9(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/trash/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 812, 20, 49812);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(813:6) {#if PICtrash}",
    		ctx
    	});

    	return block;
    }

    // (814:6) {#if PICsecret}
    function create_if_block_8(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/secret/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 813, 21, 49900);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(814:6) {#if PICsecret}",
    		ctx
    	});

    	return block;
    }

    // (815:6) {#if PICbritney}
    function create_if_block_7(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-web/7.jpg")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 814, 22, 49990);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(815:6) {#if PICbritney}",
    		ctx
    	});

    	return block;
    }

    // (816:6) {#if PICpsycho}
    function create_if_block_6(ctx) {
    	let iframe;
    	let iframe_src_value;

    	const block = {
    		c: function create() {
    			iframe = element("iframe");
    			if (iframe.src !== (iframe_src_value = "https://player.vimeo.com/video/488151130?autoplay=1&loop=1&color=ffffff&title=0&byline=0&portrait=0")) attr_dev(iframe, "src", iframe_src_value);
    			attr_dev(iframe, "width", "320");
    			attr_dev(iframe, "height", "230.5");
    			attr_dev(iframe, "frameborder", "0");
    			attr_dev(iframe, "allow", "autoplay; fullscreen");
    			iframe.allowFullscreen = true;
    			add_location(iframe, file$q, 815, 21, 50082);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, iframe, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(iframe);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(816:6) {#if PICpsycho}",
    		ctx
    	});

    	return block;
    }

    // (817:6) {#if PICbrandalism}
    function create_if_block_5(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/15.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 816, 25, 50324);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(817:6) {#if PICbrandalism}",
    		ctx
    	});

    	return block;
    }

    // (818:6) {#if PICbrandalism}
    function create_if_block_4(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/14.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 817, 25, 50427);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(818:6) {#if PICbrandalism}",
    		ctx
    	});

    	return block;
    }

    // (820:6) {#if PICegobook}
    function create_if_block_3(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/1.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 819, 22, 50613);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(820:6) {#if PICegobook}",
    		ctx
    	});

    	return block;
    }

    // (821:6) {#if PICmen}
    function create_if_block_2(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			if (img.src !== (img_src_value = "igms/undefined-undefined/aSmalltable.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 820, 18, 50708);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(821:6) {#if PICmen}",
    		ctx
    	});

    	return block;
    }

    // (822:6) {#if PICoilbuddies}
    function create_if_block_1(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			attr_dev(img, "class", "mediumPic");
    			attr_dev(img, "alt", "mynd");
    			set_style(img, "border-radius", "50px");
    			if (img.src !== (img_src_value = "igms/oilbuddies/small.png")) attr_dev(img, "src", img_src_value);
    			add_location(img, file$q, 821, 25, 50820);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, img, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(822:6) {#if PICoilbuddies}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$q(ctx) {
    	let div5;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t5;
    	let div3;
    	let t7;
    	let div4;
    	let t9;
    	let div11;
    	let div6;
    	let svg;
    	let title;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let t10;
    	let div7;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21;
    	let t22;
    	let t23;
    	let t24;
    	let t25;
    	let t26;
    	let t27;
    	let t28;
    	let t29;
    	let t30;
    	let t31;
    	let t32;
    	let t33;
    	let t34;
    	let t35;
    	let t36;
    	let t37;
    	let div8;
    	let span0;
    	let t38;
    	let t39;
    	let t40;
    	let t41;
    	let t42;
    	let t43;
    	let t44;
    	let t45;
    	let t46;
    	let t47;
    	let t48;
    	let t49;
    	let t50;
    	let t51;
    	let t52;
    	let t53;
    	let t54;
    	let t55;
    	let t56;
    	let t57;
    	let t58;
    	let t59;
    	let t60;
    	let t61;
    	let t62;
    	let div9;
    	let t63;
    	let t64;
    	let t65;
    	let t66;
    	let t67;
    	let t68;
    	let t69;
    	let t70;
    	let t71;
    	let t72;
    	let t73;
    	let t74;
    	let t75;
    	let t76;
    	let t77;
    	let t78;
    	let t79;
    	let t80;
    	let t81;
    	let t82;
    	let t83;
    	let t84;
    	let t85;
    	let t86;
    	let t87;
    	let t88;
    	let t89;
    	let div10;
    	let span1;
    	let t90;
    	let t91;
    	let t92;
    	let t93;
    	let t94;
    	let t95;
    	let t96;
    	let t97;
    	let t98;
    	let t99;
    	let t100;
    	let t101;
    	let t102;
    	let t103;
    	let t104;
    	let t105;
    	let t106;
    	let t107;
    	let t108;
    	let t109;
    	let t110;
    	let t111;
    	let t112;
    	let t113;
    	let t114;
    	let t115;
    	let t116;
    	let t117;
    	let t118;
    	let t119;
    	let t120;
    	let t121;
    	let t122;
    	let t123;
    	let t124;
    	let t125;
    	let t126;
    	let t127;
    	let t128;
    	let t129;
    	let t130;
    	let t131;
    	let t132;
    	let t133;
    	let div13;
    	let div12;
    	let img0;
    	let img0_src_value;
    	let br0;
    	let br1;
    	let t134;
    	let br2;
    	let br3;
    	let t135;
    	let i0;
    	let br4;
    	let t137;
    	let br5;
    	let t138;
    	let br6;
    	let br7;
    	let t139;
    	let i1;
    	let br8;
    	let t141;
    	let br9;
    	let t142;
    	let br10;
    	let br11;
    	let t143;
    	let span2;
    	let i2;
    	let br12;
    	let t145;
    	let i3;
    	let t147;
    	let br13;
    	let t148;
    	let br14;
    	let t149;
    	let br15;
    	let t150;
    	let br16;
    	let t151;
    	let br17;
    	let br18;
    	let t152;
    	let i4;
    	let br19;
    	let t154;
    	let br20;
    	let t155;
    	let div17;
    	let div16;
    	let div14;
    	let img1;
    	let img1_src_value;
    	let br21;
    	let br22;
    	let t156;
    	let br23;
    	let br24;
    	let t157;
    	let i5;
    	let br25;
    	let t159;
    	let br26;
    	let t160;
    	let br27;
    	let br28;
    	let t161;
    	let span3;
    	let i6;
    	let br29;
    	let t163;
    	let i7;
    	let t165;
    	let br30;
    	let t166;
    	let br31;
    	let t167;
    	let br32;
    	let t168;
    	let br33;
    	let t169;
    	let br34;
    	let br35;
    	let t170;
    	let i8;
    	let br36;
    	let t172;
    	let br37;
    	let t173;
    	let span4;
    	let br38;
    	let br39;
    	let t174;
    	let t175;
    	let br40;
    	let br41;
    	let br42;
    	let br43;
    	let t176;
    	let t177;
    	let t178;
    	let t179;
    	let t180;
    	let t181;
    	let t182;
    	let t183;
    	let t184;
    	let t185;
    	let t186;
    	let t187;
    	let t188;
    	let t189;
    	let t190;
    	let t191;
    	let t192;
    	let t193;
    	let t194;
    	let t195;
    	let t196;
    	let t197;
    	let t198;
    	let t199;
    	let div15;
    	let t200;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block0 = /*frontscreen*/ ctx[1] && create_if_block_185(ctx);
    	let if_block1 = /*onourowntime*/ ctx[2] && create_if_block_184(ctx);
    	let if_block2 = /*green*/ ctx[3] && create_if_block_183(ctx);
    	let if_block3 = /*viv*/ ctx[4] && create_if_block_182(ctx);
    	let if_block4 = /*portfolioio*/ ctx[7] && create_if_block_181(ctx);
    	let if_block5 = /*typoposters*/ ctx[5] && create_if_block_180(ctx);
    	let if_block6 = /*beauimg*/ ctx[21] && create_if_block_179(ctx);
    	let if_block7 = /*secret*/ ctx[6] && create_if_block_178(ctx);
    	let if_block8 = /*sortedplastic*/ ctx[8] && create_if_block_177(ctx);
    	let if_block9 = /*oeb*/ ctx[20] && create_if_block_176(ctx);
    	let if_block10 = /*musicposters*/ ctx[9] && create_if_block_175(ctx);
    	let if_block11 = /*timatal*/ ctx[10] && create_if_block_174(ctx);
    	let if_block12 = /*tools*/ ctx[11] && create_if_block_173(ctx);
    	let if_block13 = /*trash*/ ctx[12] && create_if_block_172(ctx);
    	let if_block14 = /*musicbook*/ ctx[13] && create_if_block_171(ctx);
    	let if_block15 = /*corruptedspace*/ ctx[14] && create_if_block_170(ctx);
    	let if_block16 = /*oilbuddies*/ ctx[15] && create_if_block_169(ctx);
    	let if_block17 = /*litabok*/ ctx[16] && create_if_block_168(ctx);
    	let if_block18 = /*plastica*/ ctx[17] && create_if_block_167(ctx);
    	let if_block19 = /*familiarfaces*/ ctx[18] && create_if_block_166(ctx);
    	let if_block20 = /*likamar*/ ctx[19] && create_if_block_165(ctx);
    	let if_block21 = /*bread*/ ctx[22] && create_if_block_164(ctx);
    	let if_block22 = /*breadmag*/ ctx[24] && create_if_block_163(ctx);
    	let if_block23 = /*flora*/ ctx[23] && create_if_block_162(ctx);
    	let if_block24 = /*evublad*/ ctx[25] && create_if_block_161(ctx);
    	let if_block25 = /*somalgors*/ ctx[26] && create_if_block_160(ctx);
    	let if_block26 = /*organogram*/ ctx[27] && create_if_block_159(ctx);
    	let if_block27 = /*frontscreen*/ ctx[1] && create_if_block_158(ctx);
    	let if_block28 = /*onourowntime*/ ctx[2] && create_if_block_157(ctx);
    	let if_block29 = /*green*/ ctx[3] && create_if_block_156(ctx);
    	let if_block30 = /*viv*/ ctx[4] && create_if_block_155(ctx);
    	let if_block31 = /*bread*/ ctx[22] && create_if_block_154(ctx);
    	let if_block32 = /*breadmag*/ ctx[24] && create_if_block_153(ctx);
    	let if_block33 = /*portfolioio*/ ctx[7] && create_if_block_152(ctx);
    	let if_block34 = /*typoposters*/ ctx[5] && create_if_block_151(ctx);
    	let if_block35 = /*beauimg*/ ctx[21] && create_if_block_150(ctx);
    	let if_block36 = /*secret*/ ctx[6] && create_if_block_149(ctx);
    	let if_block37 = /*sortedplastic*/ ctx[8] && create_if_block_148(ctx);
    	let if_block38 = /*oeb*/ ctx[20] && create_if_block_147(ctx);
    	let if_block39 = /*musicposters*/ ctx[9] && create_if_block_146(ctx);
    	let if_block40 = /*timatal*/ ctx[10] && create_if_block_145(ctx);
    	let if_block41 = /*tools*/ ctx[11] && create_if_block_144(ctx);
    	let if_block42 = /*trash*/ ctx[12] && create_if_block_143(ctx);
    	let if_block43 = /*musicbook*/ ctx[13] && create_if_block_142(ctx);
    	let if_block44 = /*corruptedspace*/ ctx[14] && create_if_block_141(ctx);
    	let if_block45 = /*oilbuddies*/ ctx[15] && create_if_block_140(ctx);
    	let if_block46 = /*litabok*/ ctx[16] && create_if_block_139(ctx);
    	let if_block47 = /*plastica*/ ctx[17] && create_if_block_138(ctx);
    	let if_block48 = /*familiarfaces*/ ctx[18] && create_if_block_137(ctx);
    	let if_block49 = /*likamar*/ ctx[19] && create_if_block_136(ctx);
    	let if_block50 = /*flora*/ ctx[23] && create_if_block_135(ctx);
    	let if_block51 = /*evublad*/ ctx[25] && create_if_block_134(ctx);
    	let if_block52 = /*frontscreen*/ ctx[1] && create_if_block_133(ctx);
    	let if_block53 = /*onourowntime*/ ctx[2] && create_if_block_132(ctx);
    	let if_block54 = /*green*/ ctx[3] && create_if_block_131(ctx);
    	let if_block55 = /*viv*/ ctx[4] && create_if_block_130(ctx);
    	let if_block56 = /*bread*/ ctx[22] && create_if_block_129(ctx);
    	let if_block57 = /*breadmag*/ ctx[24] && create_if_block_128(ctx);
    	let if_block58 = /*portfolioio*/ ctx[7] && create_if_block_127(ctx);
    	let if_block59 = /*typoposters*/ ctx[5] && create_if_block_126(ctx);
    	let if_block60 = /*beauimg*/ ctx[21] && create_if_block_125(ctx);
    	let if_block61 = /*secret*/ ctx[6] && create_if_block_124(ctx);
    	let if_block62 = /*sortedplastic*/ ctx[8] && create_if_block_123(ctx);
    	let if_block63 = /*oeb*/ ctx[20] && create_if_block_122(ctx);
    	let if_block64 = /*musicposters*/ ctx[9] && create_if_block_121(ctx);
    	let if_block65 = /*timatal*/ ctx[10] && create_if_block_120(ctx);
    	let if_block66 = /*tools*/ ctx[11] && create_if_block_119(ctx);
    	let if_block67 = /*trash*/ ctx[12] && create_if_block_118(ctx);
    	let if_block68 = /*musicbook*/ ctx[13] && create_if_block_117(ctx);
    	let if_block69 = /*corruptedspace*/ ctx[14] && create_if_block_116(ctx);
    	let if_block70 = /*oilbuddies*/ ctx[15] && create_if_block_115(ctx);
    	let if_block71 = /*litabok*/ ctx[16] && create_if_block_114(ctx);
    	let if_block72 = /*plastica*/ ctx[17] && create_if_block_113(ctx);
    	let if_block73 = /*familiarfaces*/ ctx[18] && create_if_block_112(ctx);
    	let if_block74 = /*likamar*/ ctx[19] && create_if_block_111(ctx);
    	let if_block75 = /*flora*/ ctx[23] && create_if_block_110(ctx);
    	let if_block76 = /*evublad*/ ctx[25] && create_if_block_109(ctx);
    	let if_block77 = /*somalgors*/ ctx[26] && create_if_block_108(ctx);
    	let if_block78 = /*organogram*/ ctx[27] && create_if_block_107(ctx);
    	let if_block79 = /*frontscreen*/ ctx[1] && create_if_block_106(ctx);
    	let if_block80 = /*onourowntime*/ ctx[2] && create_if_block_105(ctx);
    	let if_block81 = /*viv*/ ctx[4] && create_if_block_104(ctx);
    	let if_block82 = /*typoposters*/ ctx[5] && create_if_block_103(ctx);
    	let if_block83 = /*secret*/ ctx[6] && create_if_block_102(ctx);
    	let if_block84 = /*tools*/ ctx[11] && create_if_block_101(ctx);
    	let if_block85 = /*timatal*/ ctx[10] && create_if_block_100(ctx);
    	let if_block86 = /*sortedplastic*/ ctx[8] && create_if_block_99(ctx);
    	let if_block87 = /*litabok*/ ctx[16] && create_if_block_98(ctx);
    	let if_block88 = /*oilbuddies*/ ctx[15] && create_if_block_97(ctx);
    	let if_block89 = /*trash*/ ctx[12] && create_if_block_96(ctx);
    	let if_block90 = /*familiarfaces*/ ctx[18] && create_if_block_95(ctx);
    	let if_block91 = /*musicbook*/ ctx[13] && create_if_block_94(ctx);
    	let if_block92 = /*plastica*/ ctx[17] && create_if_block_93(ctx);
    	let if_block93 = /*corruptedspace*/ ctx[14] && create_if_block_92(ctx);
    	let if_block94 = /*likamar*/ ctx[19] && create_if_block_91(ctx);
    	let if_block95 = /*green*/ ctx[3] && create_if_block_90(ctx);
    	let if_block96 = /*evublad*/ ctx[25] && create_if_block_89(ctx);
    	let if_block97 = /*onourowntime*/ ctx[2] && create_if_block_88(ctx);
    	let if_block98 = /*green*/ ctx[3] && create_if_block_87(ctx);
    	let if_block99 = /*viv*/ ctx[4] && create_if_block_86(ctx);
    	let if_block100 = /*portfolioio*/ ctx[7] && create_if_block_85(ctx);
    	let if_block101 = /*typoposters*/ ctx[5] && create_if_block_84(ctx);
    	let if_block102 = /*secret*/ ctx[6] && create_if_block_83(ctx);
    	let if_block103 = /*sortedplastic*/ ctx[8] && create_if_block_82(ctx);
    	let if_block104 = /*musicposters*/ ctx[9] && create_if_block_81(ctx);
    	let if_block105 = /*timatal*/ ctx[10] && create_if_block_80(ctx);
    	let if_block106 = /*tools*/ ctx[11] && create_if_block_79(ctx);
    	let if_block107 = /*trash*/ ctx[12] && create_if_block_78(ctx);
    	let if_block108 = /*musicbook*/ ctx[13] && create_if_block_77(ctx);
    	let if_block109 = /*corruptedspace*/ ctx[14] && create_if_block_76(ctx);
    	let if_block110 = /*oilbuddies*/ ctx[15] && create_if_block_75(ctx);
    	let if_block111 = /*litabok*/ ctx[16] && create_if_block_74(ctx);
    	let if_block112 = /*plastica*/ ctx[17] && create_if_block_73(ctx);
    	let if_block113 = /*familiarfaces*/ ctx[18] && create_if_block_72(ctx);
    	let if_block114 = /*likamar*/ ctx[19] && create_if_block_71(ctx);
    	let if_block115 = /*oeb*/ ctx[20] && create_if_block_70(ctx);
    	let if_block116 = /*beauimg*/ ctx[21] && create_if_block_69(ctx);
    	let if_block117 = /*bread*/ ctx[22] && create_if_block_68(ctx);
    	let if_block118 = /*flora*/ ctx[23] && create_if_block_67(ctx);
    	let if_block119 = /*breadmag*/ ctx[24] && create_if_block_66(ctx);
    	let if_block120 = /*evublad*/ ctx[25] && create_if_block_65(ctx);
    	let if_block121 = /*somalgors*/ ctx[26] && create_if_block_64(ctx);
    	let if_block122 = /*organogram*/ ctx[27] && create_if_block_63(ctx);
    	let if_block123 = /*PICflora*/ ctx[49] && create_if_block_62(ctx);
    	let if_block124 = /*PIConourowntime*/ ctx[28] && create_if_block_61(ctx);
    	let if_block125 = /*PICgreen*/ ctx[29] && create_if_block_60(ctx);
    	let if_block126 = /*PICviv*/ ctx[30] && create_if_block_59(ctx);
    	let if_block127 = /*PICbread*/ ctx[48] && create_if_block_58(ctx);
    	let if_block128 = /*PICbreadmag*/ ctx[50] && create_if_block_57(ctx);
    	let if_block129 = /*PICportfolioio*/ ctx[33] && create_if_block_56(ctx);
    	let if_block130 = /*PICbeauimg*/ ctx[47] && create_if_block_55(ctx);
    	let if_block131 = /*PICtypoposters*/ ctx[31] && create_if_block_54(ctx);
    	let if_block132 = /*PICoeb*/ ctx[46] && create_if_block_53(ctx);
    	let if_block133 = /*PICsortedplastic*/ ctx[34] && create_if_block_52(ctx);
    	let if_block134 = /*PICmusicposters*/ ctx[35] && create_if_block_51(ctx);
    	let if_block135 = /*PICtimatal*/ ctx[36] && create_if_block_50(ctx);
    	let if_block136 = /*PICtools*/ ctx[37] && create_if_block_49(ctx);
    	let if_block137 = /*PICfamiliarfaces*/ ctx[44] && create_if_block_48(ctx);
    	let if_block138 = /*PICmusicbook*/ ctx[39] && create_if_block_47(ctx);
    	let if_block139 = /*PICcorruptedspace*/ ctx[40] && create_if_block_46(ctx);
    	let if_block140 = /*PICsomalgors*/ ctx[52] && create_if_block_45(ctx);
    	let if_block141 = /*PIClitabok*/ ctx[42] && create_if_block_44(ctx);
    	let if_block142 = /*PICevublad*/ ctx[51] && create_if_block_43(ctx);
    	let if_block143 = /*PICplastica*/ ctx[43] && create_if_block_42(ctx);
    	let if_block144 = /*PICorgano*/ ctx[56] && create_if_block_41(ctx);
    	let if_block145 = /*PIClikamar*/ ctx[45] && create_if_block_40(ctx);
    	let if_block146 = /*other*/ ctx[78] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = "WEB";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "PRINT";
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = "VIDEO";
    			t5 = space();
    			div3 = element("div");
    			div3.textContent = "OTHER";
    			t7 = space();
    			div4 = element("div");
    			div4.textContent = "ALL";
    			t9 = space();
    			div11 = element("div");
    			div6 = element("div");
    			svg = svg_element("svg");
    			title = svg_element("title");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			t10 = space();
    			div7 = element("div");
    			if (if_block0) if_block0.c();
    			t11 = space();
    			if (if_block1) if_block1.c();
    			t12 = space();
    			if (if_block2) if_block2.c();
    			t13 = space();
    			if (if_block3) if_block3.c();
    			t14 = space();
    			if (if_block4) if_block4.c();
    			t15 = space();
    			if (if_block5) if_block5.c();
    			t16 = space();
    			if (if_block6) if_block6.c();
    			t17 = space();
    			if (if_block7) if_block7.c();
    			t18 = space();
    			if (if_block8) if_block8.c();
    			t19 = space();
    			if (if_block9) if_block9.c();
    			t20 = space();
    			if (if_block10) if_block10.c();
    			t21 = space();
    			if (if_block11) if_block11.c();
    			t22 = space();
    			if (if_block12) if_block12.c();
    			t23 = space();
    			if (if_block13) if_block13.c();
    			t24 = space();
    			if (if_block14) if_block14.c();
    			t25 = space();
    			if (if_block15) if_block15.c();
    			t26 = space();
    			if (if_block16) if_block16.c();
    			t27 = space();
    			if (if_block17) if_block17.c();
    			t28 = space();
    			if (if_block18) if_block18.c();
    			t29 = space();
    			if (if_block19) if_block19.c();
    			t30 = space();
    			if (if_block20) if_block20.c();
    			t31 = space();
    			if (if_block21) if_block21.c();
    			t32 = space();
    			if (if_block22) if_block22.c();
    			t33 = space();
    			if (if_block23) if_block23.c();
    			t34 = space();
    			if (if_block24) if_block24.c();
    			t35 = space();
    			if (if_block25) if_block25.c();
    			t36 = space();
    			if (if_block26) if_block26.c();
    			t37 = space();
    			div8 = element("div");
    			span0 = element("span");
    			if (if_block27) if_block27.c();
    			t38 = space();
    			if (if_block28) if_block28.c();
    			t39 = space();
    			if (if_block29) if_block29.c();
    			t40 = space();
    			if (if_block30) if_block30.c();
    			t41 = space();
    			if (if_block31) if_block31.c();
    			t42 = space();
    			if (if_block32) if_block32.c();
    			t43 = space();
    			if (if_block33) if_block33.c();
    			t44 = space();
    			if (if_block34) if_block34.c();
    			t45 = space();
    			if (if_block35) if_block35.c();
    			t46 = space();
    			if (if_block36) if_block36.c();
    			t47 = space();
    			if (if_block37) if_block37.c();
    			t48 = space();
    			if (if_block38) if_block38.c();
    			t49 = space();
    			if (if_block39) if_block39.c();
    			t50 = space();
    			if (if_block40) if_block40.c();
    			t51 = space();
    			if (if_block41) if_block41.c();
    			t52 = space();
    			if (if_block42) if_block42.c();
    			t53 = space();
    			if (if_block43) if_block43.c();
    			t54 = space();
    			if (if_block44) if_block44.c();
    			t55 = space();
    			if (if_block45) if_block45.c();
    			t56 = space();
    			if (if_block46) if_block46.c();
    			t57 = space();
    			if (if_block47) if_block47.c();
    			t58 = space();
    			if (if_block48) if_block48.c();
    			t59 = space();
    			if (if_block49) if_block49.c();
    			t60 = space();
    			if (if_block50) if_block50.c();
    			t61 = space();
    			if (if_block51) if_block51.c();
    			t62 = space();
    			div9 = element("div");
    			if (if_block52) if_block52.c();
    			t63 = space();
    			if (if_block53) if_block53.c();
    			t64 = space();
    			if (if_block54) if_block54.c();
    			t65 = space();
    			if (if_block55) if_block55.c();
    			t66 = space();
    			if (if_block56) if_block56.c();
    			t67 = space();
    			if (if_block57) if_block57.c();
    			t68 = space();
    			if (if_block58) if_block58.c();
    			t69 = space();
    			if (if_block59) if_block59.c();
    			t70 = space();
    			if (if_block60) if_block60.c();
    			t71 = space();
    			if (if_block61) if_block61.c();
    			t72 = space();
    			if (if_block62) if_block62.c();
    			t73 = space();
    			if (if_block63) if_block63.c();
    			t74 = space();
    			if (if_block64) if_block64.c();
    			t75 = space();
    			if (if_block65) if_block65.c();
    			t76 = space();
    			if (if_block66) if_block66.c();
    			t77 = space();
    			if (if_block67) if_block67.c();
    			t78 = space();
    			if (if_block68) if_block68.c();
    			t79 = space();
    			if (if_block69) if_block69.c();
    			t80 = space();
    			if (if_block70) if_block70.c();
    			t81 = space();
    			if (if_block71) if_block71.c();
    			t82 = space();
    			if (if_block72) if_block72.c();
    			t83 = space();
    			if (if_block73) if_block73.c();
    			t84 = space();
    			if (if_block74) if_block74.c();
    			t85 = space();
    			if (if_block75) if_block75.c();
    			t86 = space();
    			if (if_block76) if_block76.c();
    			t87 = space();
    			if (if_block77) if_block77.c();
    			t88 = space();
    			if (if_block78) if_block78.c();
    			t89 = space();
    			div10 = element("div");
    			span1 = element("span");
    			if (if_block79) if_block79.c();
    			t90 = space();
    			if (if_block80) if_block80.c();
    			t91 = space();
    			if (if_block81) if_block81.c();
    			t92 = space();
    			if (if_block82) if_block82.c();
    			t93 = space();
    			if (if_block83) if_block83.c();
    			t94 = space();
    			if (if_block84) if_block84.c();
    			t95 = space();
    			if (if_block85) if_block85.c();
    			t96 = space();
    			if (if_block86) if_block86.c();
    			t97 = space();
    			if (if_block87) if_block87.c();
    			t98 = space();
    			if (if_block88) if_block88.c();
    			t99 = space();
    			if (if_block89) if_block89.c();
    			t100 = space();
    			if (if_block90) if_block90.c();
    			t101 = space();
    			if (if_block91) if_block91.c();
    			t102 = space();
    			if (if_block92) if_block92.c();
    			t103 = space();
    			if (if_block93) if_block93.c();
    			t104 = space();
    			if (if_block94) if_block94.c();
    			t105 = space();
    			if (if_block95) if_block95.c();
    			t106 = space();
    			if (if_block96) if_block96.c();
    			t107 = space();
    			if (if_block97) if_block97.c();
    			t108 = space();
    			if (if_block98) if_block98.c();
    			t109 = space();
    			if (if_block99) if_block99.c();
    			t110 = space();
    			if (if_block100) if_block100.c();
    			t111 = space();
    			if (if_block101) if_block101.c();
    			t112 = space();
    			if (if_block102) if_block102.c();
    			t113 = space();
    			if (if_block103) if_block103.c();
    			t114 = space();
    			if (if_block104) if_block104.c();
    			t115 = space();
    			if (if_block105) if_block105.c();
    			t116 = space();
    			if (if_block106) if_block106.c();
    			t117 = space();
    			if (if_block107) if_block107.c();
    			t118 = space();
    			if (if_block108) if_block108.c();
    			t119 = space();
    			if (if_block109) if_block109.c();
    			t120 = space();
    			if (if_block110) if_block110.c();
    			t121 = space();
    			if (if_block111) if_block111.c();
    			t122 = space();
    			if (if_block112) if_block112.c();
    			t123 = space();
    			if (if_block113) if_block113.c();
    			t124 = space();
    			if (if_block114) if_block114.c();
    			t125 = space();
    			if (if_block115) if_block115.c();
    			t126 = space();
    			if (if_block116) if_block116.c();
    			t127 = space();
    			if (if_block117) if_block117.c();
    			t128 = space();
    			if (if_block118) if_block118.c();
    			t129 = space();
    			if (if_block119) if_block119.c();
    			t130 = space();
    			if (if_block120) if_block120.c();
    			t131 = space();
    			if (if_block121) if_block121.c();
    			t132 = space();
    			if (if_block122) if_block122.c();
    			t133 = space();
    			div13 = element("div");
    			div12 = element("div");
    			img0 = element("img");
    			br0 = element("br");
    			br1 = element("br");
    			t134 = text("\n      BERGLIND BRÁ");
    			br2 = element("br");
    			br3 = element("br");
    			t135 = space();
    			i0 = element("i");
    			i0.textContent = "Education";
    			br4 = element("br");
    			t137 = text("\n      Sjónlist 2015, Myndlistaskólinn í Reykjavík");
    			br5 = element("br");
    			t138 = text("\n      Graphic Design BA 2020, The Royal Academy of Art, The Hague\n      ");
    			br6 = element("br");
    			br7 = element("br");
    			t139 = space();
    			i1 = element("i");
    			i1.textContent = "Specialities";
    			br8 = element("br");
    			t141 = text("\n      Web design and building");
    			br9 = element("br");
    			t142 = text("\n      Typography and layout\n      ");
    			br10 = element("br");
    			br11 = element("br");
    			t143 = space();
    			span2 = element("span");
    			i2 = element("i");
    			i2.textContent = "Work experience";
    			br12 = element("br");
    			t145 = text("\n      Designing ");
    			i3 = element("i");
    			i3.textContent = "Kortlagning á kynjasjónarmiðum - Stöðuskýrsla 2021";
    			t147 = text(" report for Iceland's Prime Minister's Office and Ministry of Finance and Economic Affairs");
    			br13 = element("br");
    			t148 = text("\n      Designing drink-menu and gift card for Kaffihús Vesturbæjar");
    			br14 = element("br");
    			t149 = text("\n      Graphic design / web building for Flóra útgáfa");
    			br15 = element("br");
    			t150 = text("\n      Internship at Somalgors74 / Curdin Tones");
    			br16 = element("br");
    			t151 = text("\n      Portfolio website design and building for photographer Io Alexa Sivertsen");
    			br17 = element("br");
    			br18 = element("br");
    			t152 = space();
    			i4 = element("i");
    			i4.textContent = "Contact";
    			br19 = element("br");
    			t154 = text("\n      berglindbra28@gmail.com");
    			br20 = element("br");
    			t155 = space();
    			div17 = element("div");
    			div16 = element("div");
    			div14 = element("div");
    			img1 = element("img");
    			br21 = element("br");
    			br22 = element("br");
    			t156 = text("\n      BERGLIND BRÁ");
    			br23 = element("br");
    			br24 = element("br");
    			t157 = space();
    			i5 = element("i");
    			i5.textContent = "Education";
    			br25 = element("br");
    			t159 = text("\n      Sjónlist 2015, Myndlistaskólinn í Reykjavík");
    			br26 = element("br");
    			t160 = text("\n      Graphic Design BA 2020, The Royal Academy of Art, The Hague\n      ");
    			br27 = element("br");
    			br28 = element("br");
    			t161 = space();
    			span3 = element("span");
    			i6 = element("i");
    			i6.textContent = "Work experience";
    			br29 = element("br");
    			t163 = text("\n      Designing ");
    			i7 = element("i");
    			i7.textContent = "Kortlagning á kynjasjónarmiðum - Stöðuskýrsla 2021";
    			t165 = text(" report for Iceland's Prime Minister's Office and Ministry of Finance and Economic Affairs");
    			br30 = element("br");
    			t166 = text("\n      Designing drink-menu and gift card for Kaffihús Vesturbæjar");
    			br31 = element("br");
    			t167 = text("\n      Graphic design / web building for Flóra útgáfa");
    			br32 = element("br");
    			t168 = text("\n      Internship at Somalgors74 / Curdin Tones");
    			br33 = element("br");
    			t169 = text("\n      Portfolio website design and building for photographer Io Alexa Sivertsen");
    			br34 = element("br");
    			br35 = element("br");
    			t170 = space();
    			i8 = element("i");
    			i8.textContent = "Contact";
    			br36 = element("br");
    			t172 = text("\n      berglindbra28@gmail.com");
    			br37 = element("br");
    			t173 = space();
    			span4 = element("span");
    			br38 = element("br");
    			br39 = element("br");
    			t174 = text("**MOBILE VERSION IS UNDER CONSTRUCTION**");
    			t175 = space();
    			br40 = element("br");
    			br41 = element("br");
    			br42 = element("br");
    			br43 = element("br");
    			t176 = space();
    			if (if_block123) if_block123.c();
    			t177 = space();
    			if (if_block124) if_block124.c();
    			t178 = space();
    			if (if_block125) if_block125.c();
    			t179 = space();
    			if (if_block126) if_block126.c();
    			t180 = space();
    			if (if_block127) if_block127.c();
    			t181 = space();
    			if (if_block128) if_block128.c();
    			t182 = space();
    			if (if_block129) if_block129.c();
    			t183 = space();
    			if (if_block130) if_block130.c();
    			t184 = space();
    			if (if_block131) if_block131.c();
    			t185 = space();
    			if (if_block132) if_block132.c();
    			t186 = space();
    			if (if_block133) if_block133.c();
    			t187 = space();
    			if (if_block134) if_block134.c();
    			t188 = space();
    			if (if_block135) if_block135.c();
    			t189 = space();
    			if (if_block136) if_block136.c();
    			t190 = space();
    			if (if_block137) if_block137.c();
    			t191 = space();
    			if (if_block138) if_block138.c();
    			t192 = space();
    			if (if_block139) if_block139.c();
    			t193 = space();
    			if (if_block140) if_block140.c();
    			t194 = space();
    			if (if_block141) if_block141.c();
    			t195 = space();
    			if (if_block142) if_block142.c();
    			t196 = space();
    			if (if_block143) if_block143.c();
    			t197 = space();
    			if (if_block144) if_block144.c();
    			t198 = space();
    			if (if_block145) if_block145.c();
    			t199 = space();
    			div15 = element("div");
    			t200 = space();
    			if (if_block146) if_block146.c();
    			attr_dev(div0, "class", "button");
    			add_location(div0, file$q, 484, 2, 25744);
    			attr_dev(div1, "class", "button");
    			add_location(div1, file$q, 485, 2, 25797);
    			attr_dev(div2, "class", "button");
    			add_location(div2, file$q, 486, 2, 25854);
    			attr_dev(div3, "class", "button");
    			add_location(div3, file$q, 487, 2, 25911);
    			attr_dev(div4, "class", "button");
    			add_location(div4, file$q, 488, 2, 25968);
    			attr_dev(div5, "class", "buttonWrapper");
    			add_location(div5, file$q, 483, 0, 25714);
    			add_location(title, file$q, 496, 93, 26282);
    			attr_dev(path0, "class", "toggle-fullscreen-color");
    			attr_dev(path0, "d", "M94.92358,5.61908a1.00026,1.00026,0,0,0-.20459-.30829c-.00512-.00537-.00659-.01263-.012-.01794-.00757-.00751-.01782-.00965-.02551-.01691A.97055.97055,0,0,0,93.99963,5H80a1,1,0,0,0,0,2V6.99994H91.58569L60.99988,37.58582V26a.99988.99988,0,1,0-1.99976,0L59,39.99994h0V40l.00049.002A1.00189,1.00189,0,0,0,60,40.99994H74a.99994.99994,0,0,0,0-1.99988V39H62.41406L92.99988,8.41425,93,20a1,1,0,0,0,2,0L94.99988,6.00024A.99724.99724,0,0,0,94.92358,5.61908Z");
    			add_location(path0, file$q, 496, 101, 26290);
    			attr_dev(path1, "class", "toggle-fullscreen-color");
    			attr_dev(path1, "d", "M6,21a1,1,0,0,0,1-1H6.99988V8.41412L37.58569,38.99994,26,39a1,1,0,0,0,0,2l14-.00006.00208-.00043a.96771.96771,0,0,0,.67944-.27551c.00769-.00726.01794-.0094.02551-.01691.00537-.00531.00684-.01257.012-.01794a.98308.98308,0,0,0,.28089-.68952V26a.99988.99988,0,1,0-1.99976,0H39V37.58582L8.41406,6.99994H20A1,1,0,0,0,20,5H6.00024A1.00258,1.00258,0,0,0,5,6H5V20A1,1,0,0,0,6,21Z");
    			add_location(path1, file$q, 496, 592, 26781);
    			attr_dev(path2, "class", "toggle-fullscreen-color");
    			attr_dev(path2, "d", "M79,94a1,1,0,0,0,1,1l14-.00006.00208-.00043a.96771.96771,0,0,0,.67944-.27551c.00769-.00726.01794-.0094.02551-.01691.00537-.00531.00684-.01257.012-.01794a.98308.98308,0,0,0,.28089-.68952V80a.99988.99988,0,0,0-1.99976,0H93V91.58582L62.41406,60.99988,74,60.99994a.99994.99994,0,0,0,0-1.99988L60.00024,59A1.00258,1.00258,0,0,0,59,60h0V74a1,1,0,0,0,2,0h-.00012V62.41412L91.58569,92.99994,80,93A.99993.99993,0,0,0,79,94Z");
    			add_location(path2, file$q, 496, 1007, 27196);
    			attr_dev(path3, "class", "toggle-fullscreen-color");
    			attr_dev(path3, "d", "M5.00049,94.002A1.00189,1.00189,0,0,0,6,94.99994H20a.99994.99994,0,0,0,0-1.99988V93H8.41406L38.99988,62.41425,39,74a1,1,0,0,0,2,0l-.00012-13.99976a.98308.98308,0,0,0-.28089-.68945c-.00512-.00537-.00659-.01263-.012-.01794-.00757-.00751-.01782-.00965-.02551-.01691A.97055.97055,0,0,0,39.99963,59H26a1,1,0,0,0,0,2v-.00006H37.58569L6.99988,91.58582V80a.99988.99988,0,1,0-1.99976,0L5,93.99994H5V94Z");
    			add_location(path3, file$q, 496, 1465, 27654);
    			attr_dev(svg, "viewBox", "0 0 100 100");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "class", "togglefullscreen svelte-i9x7wk");
    			add_location(svg, file$q, 496, 6, 26195);
    			attr_dev(div6, "class", "menu expandscreen");
    			add_location(div6, file$q, 495, 4, 26095);
    			attr_dev(div7, "class", "date mainscreen-main svelte-i9x7wk");
    			add_location(div7, file$q, 500, 2, 28113);
    			attr_dev(span0, "class", "subtitles-text");
    			add_location(span0, file$q, 530, 50, 29164);
    			attr_dev(div8, "class", "subtitlesDate mainscreen-subtitles");
    			add_location(div8, file$q, 530, 2, 29116);
    			attr_dev(div9, "class", "name mainscreen-main svelte-i9x7wk");
    			add_location(div9, file$q, 558, 2, 30018);
    			attr_dev(span1, "class", "subtitles-text");
    			add_location(span1, file$q, 588, 4, 31640);
    			attr_dev(div10, "class", "subtitlesName mainscreen-subtitles");
    			add_location(div10, file$q, 587, 2, 31587);
    			attr_dev(div11, "id", "Screen");
    			attr_dev(div11, "class", "containerMiddleScroll svelte-i9x7wk");
    			toggle_class(div11, "expand", /*expand*/ ctx[0]);
    			add_location(div11, file$q, 493, 0, 26029);
    			attr_dev(img0, "class", "logoBio");
    			attr_dev(img0, "alt", "mynd");
    			if (img0.src !== (img0_src_value = "igms/icons/BBJsmall2.png")) attr_dev(img0, "src", img0_src_value);
    			add_location(img0, file$q, 649, 6, 36030);
    			add_location(br0, file$q, 649, 69, 36093);
    			add_location(br1, file$q, 649, 73, 36097);
    			add_location(br2, file$q, 650, 18, 36120);
    			add_location(br3, file$q, 650, 22, 36124);
    			add_location(i0, file$q, 651, 6, 36135);
    			add_location(br4, file$q, 651, 22, 36151);
    			add_location(br5, file$q, 652, 49, 36205);
    			add_location(br6, file$q, 654, 6, 36282);
    			add_location(br7, file$q, 654, 10, 36286);
    			add_location(i1, file$q, 655, 6, 36297);
    			add_location(br8, file$q, 655, 25, 36316);
    			add_location(br9, file$q, 656, 29, 36350);
    			add_location(br10, file$q, 658, 6, 36389);
    			add_location(br11, file$q, 658, 10, 36393);
    			add_location(i2, file$q, 659, 34, 36432);
    			add_location(br12, file$q, 659, 56, 36454);
    			add_location(i3, file$q, 660, 16, 36475);
    			add_location(br13, file$q, 660, 178, 36637);
    			add_location(br14, file$q, 661, 65, 36707);
    			add_location(br15, file$q, 662, 52, 36764);
    			add_location(br16, file$q, 663, 46, 36815);
    			add_location(br17, file$q, 664, 79, 36899);
    			add_location(br18, file$q, 664, 83, 36903);
    			attr_dev(span2, "class", "out-on-mobile");
    			add_location(span2, file$q, 659, 6, 36404);
    			add_location(i4, file$q, 668, 6, 36986);
    			add_location(br19, file$q, 668, 20, 37000);
    			add_location(br20, file$q, 669, 29, 37034);
    			attr_dev(div12, "class", "biography-text");
    			add_location(div12, file$q, 648, 2, 35995);
    			attr_dev(div13, "class", "biography out-on-mobile");
    			add_location(div13, file$q, 646, 0, 35952);
    			attr_dev(img1, "class", "logoBio");
    			attr_dev(img1, "alt", "mynd");
    			if (img1.src !== (img1_src_value = "igms/icons/BBJsmall2.png")) attr_dev(img1, "src", img1_src_value);
    			add_location(img1, file$q, 688, 6, 37379);
    			add_location(br21, file$q, 688, 69, 37442);
    			add_location(br22, file$q, 688, 73, 37446);
    			add_location(br23, file$q, 689, 18, 37469);
    			add_location(br24, file$q, 689, 22, 37473);
    			add_location(i5, file$q, 690, 6, 37484);
    			add_location(br25, file$q, 690, 22, 37500);
    			add_location(br26, file$q, 691, 49, 37554);
    			add_location(br27, file$q, 693, 6, 37641);
    			add_location(br28, file$q, 693, 10, 37645);
    			add_location(i6, file$q, 694, 12, 37662);
    			add_location(br29, file$q, 694, 34, 37684);
    			add_location(i7, file$q, 695, 16, 37705);
    			add_location(br30, file$q, 695, 178, 37867);
    			add_location(br31, file$q, 696, 65, 37937);
    			add_location(br32, file$q, 697, 52, 37994);
    			add_location(br33, file$q, 698, 46, 38045);
    			add_location(br34, file$q, 699, 79, 38129);
    			add_location(br35, file$q, 699, 83, 38133);
    			add_location(span3, file$q, 694, 6, 37656);
    			add_location(i8, file$q, 703, 6, 38216);
    			add_location(br36, file$q, 703, 20, 38230);
    			add_location(br37, file$q, 704, 29, 38264);
    			add_location(br38, file$q, 706, 61, 38419);
    			add_location(br39, file$q, 706, 65, 38423);
    			attr_dev(span4, "class", "construction");
    			set_style(span4, "text-align", "center");
    			add_location(span4, file$q, 706, 6, 38364);
    			attr_dev(div14, "class", "biography-text biography-text-mobile out-on-desktop");
    			add_location(div14, file$q, 687, 4, 37307);
    			add_location(br40, file$q, 709, 4, 38494);
    			add_location(br41, file$q, 709, 8, 38498);
    			add_location(br42, file$q, 709, 12, 38502);
    			add_location(br43, file$q, 709, 16, 38506);
    			attr_dev(div15, "class", "line svelte-i9x7wk");
    			add_location(div15, file$q, 749, 5, 43285);
    			attr_dev(div16, "class", "wrapper back");
    			add_location(div16, file$q, 679, 2, 37175);
    			attr_dev(div17, "class", "container");
    			add_location(div17, file$q, 677, 0, 37148);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			append_dev(div5, t3);
    			append_dev(div5, div2);
    			append_dev(div5, t5);
    			append_dev(div5, div3);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			insert_dev(target, t9, anchor);
    			insert_dev(target, div11, anchor);
    			append_dev(div11, div6);
    			append_dev(div6, svg);
    			append_dev(svg, title);
    			append_dev(svg, path0);
    			append_dev(svg, path1);
    			append_dev(svg, path2);
    			append_dev(svg, path3);
    			append_dev(div11, t10);
    			append_dev(div11, div7);
    			if (if_block0) if_block0.m(div7, null);
    			append_dev(div7, t11);
    			if (if_block1) if_block1.m(div7, null);
    			append_dev(div7, t12);
    			if (if_block2) if_block2.m(div7, null);
    			append_dev(div7, t13);
    			if (if_block3) if_block3.m(div7, null);
    			append_dev(div7, t14);
    			if (if_block4) if_block4.m(div7, null);
    			append_dev(div7, t15);
    			if (if_block5) if_block5.m(div7, null);
    			append_dev(div7, t16);
    			if (if_block6) if_block6.m(div7, null);
    			append_dev(div7, t17);
    			if (if_block7) if_block7.m(div7, null);
    			append_dev(div7, t18);
    			if (if_block8) if_block8.m(div7, null);
    			append_dev(div7, t19);
    			if (if_block9) if_block9.m(div7, null);
    			append_dev(div7, t20);
    			if (if_block10) if_block10.m(div7, null);
    			append_dev(div7, t21);
    			if (if_block11) if_block11.m(div7, null);
    			append_dev(div7, t22);
    			if (if_block12) if_block12.m(div7, null);
    			append_dev(div7, t23);
    			if (if_block13) if_block13.m(div7, null);
    			append_dev(div7, t24);
    			if (if_block14) if_block14.m(div7, null);
    			append_dev(div7, t25);
    			if (if_block15) if_block15.m(div7, null);
    			append_dev(div7, t26);
    			if (if_block16) if_block16.m(div7, null);
    			append_dev(div7, t27);
    			if (if_block17) if_block17.m(div7, null);
    			append_dev(div7, t28);
    			if (if_block18) if_block18.m(div7, null);
    			append_dev(div7, t29);
    			if (if_block19) if_block19.m(div7, null);
    			append_dev(div7, t30);
    			if (if_block20) if_block20.m(div7, null);
    			append_dev(div7, t31);
    			if (if_block21) if_block21.m(div7, null);
    			append_dev(div7, t32);
    			if (if_block22) if_block22.m(div7, null);
    			append_dev(div7, t33);
    			if (if_block23) if_block23.m(div7, null);
    			append_dev(div7, t34);
    			if (if_block24) if_block24.m(div7, null);
    			append_dev(div7, t35);
    			if (if_block25) if_block25.m(div7, null);
    			append_dev(div7, t36);
    			if (if_block26) if_block26.m(div7, null);
    			append_dev(div11, t37);
    			append_dev(div11, div8);
    			append_dev(div8, span0);
    			if (if_block27) if_block27.m(span0, null);
    			append_dev(span0, t38);
    			if (if_block28) if_block28.m(span0, null);
    			append_dev(span0, t39);
    			if (if_block29) if_block29.m(span0, null);
    			append_dev(span0, t40);
    			if (if_block30) if_block30.m(span0, null);
    			append_dev(span0, t41);
    			if (if_block31) if_block31.m(span0, null);
    			append_dev(span0, t42);
    			if (if_block32) if_block32.m(span0, null);
    			append_dev(span0, t43);
    			if (if_block33) if_block33.m(span0, null);
    			append_dev(span0, t44);
    			if (if_block34) if_block34.m(span0, null);
    			append_dev(span0, t45);
    			if (if_block35) if_block35.m(span0, null);
    			append_dev(span0, t46);
    			if (if_block36) if_block36.m(span0, null);
    			append_dev(span0, t47);
    			if (if_block37) if_block37.m(span0, null);
    			append_dev(span0, t48);
    			if (if_block38) if_block38.m(span0, null);
    			append_dev(span0, t49);
    			if (if_block39) if_block39.m(span0, null);
    			append_dev(span0, t50);
    			if (if_block40) if_block40.m(span0, null);
    			append_dev(span0, t51);
    			if (if_block41) if_block41.m(span0, null);
    			append_dev(span0, t52);
    			if (if_block42) if_block42.m(span0, null);
    			append_dev(span0, t53);
    			if (if_block43) if_block43.m(span0, null);
    			append_dev(span0, t54);
    			if (if_block44) if_block44.m(span0, null);
    			append_dev(span0, t55);
    			if (if_block45) if_block45.m(span0, null);
    			append_dev(span0, t56);
    			if (if_block46) if_block46.m(span0, null);
    			append_dev(span0, t57);
    			if (if_block47) if_block47.m(span0, null);
    			append_dev(span0, t58);
    			if (if_block48) if_block48.m(span0, null);
    			append_dev(span0, t59);
    			if (if_block49) if_block49.m(span0, null);
    			append_dev(span0, t60);
    			if (if_block50) if_block50.m(span0, null);
    			append_dev(span0, t61);
    			if (if_block51) if_block51.m(span0, null);
    			append_dev(div11, t62);
    			append_dev(div11, div9);
    			if (if_block52) if_block52.m(div9, null);
    			append_dev(div9, t63);
    			if (if_block53) if_block53.m(div9, null);
    			append_dev(div9, t64);
    			if (if_block54) if_block54.m(div9, null);
    			append_dev(div9, t65);
    			if (if_block55) if_block55.m(div9, null);
    			append_dev(div9, t66);
    			if (if_block56) if_block56.m(div9, null);
    			append_dev(div9, t67);
    			if (if_block57) if_block57.m(div9, null);
    			append_dev(div9, t68);
    			if (if_block58) if_block58.m(div9, null);
    			append_dev(div9, t69);
    			if (if_block59) if_block59.m(div9, null);
    			append_dev(div9, t70);
    			if (if_block60) if_block60.m(div9, null);
    			append_dev(div9, t71);
    			if (if_block61) if_block61.m(div9, null);
    			append_dev(div9, t72);
    			if (if_block62) if_block62.m(div9, null);
    			append_dev(div9, t73);
    			if (if_block63) if_block63.m(div9, null);
    			append_dev(div9, t74);
    			if (if_block64) if_block64.m(div9, null);
    			append_dev(div9, t75);
    			if (if_block65) if_block65.m(div9, null);
    			append_dev(div9, t76);
    			if (if_block66) if_block66.m(div9, null);
    			append_dev(div9, t77);
    			if (if_block67) if_block67.m(div9, null);
    			append_dev(div9, t78);
    			if (if_block68) if_block68.m(div9, null);
    			append_dev(div9, t79);
    			if (if_block69) if_block69.m(div9, null);
    			append_dev(div9, t80);
    			if (if_block70) if_block70.m(div9, null);
    			append_dev(div9, t81);
    			if (if_block71) if_block71.m(div9, null);
    			append_dev(div9, t82);
    			if (if_block72) if_block72.m(div9, null);
    			append_dev(div9, t83);
    			if (if_block73) if_block73.m(div9, null);
    			append_dev(div9, t84);
    			if (if_block74) if_block74.m(div9, null);
    			append_dev(div9, t85);
    			if (if_block75) if_block75.m(div9, null);
    			append_dev(div9, t86);
    			if (if_block76) if_block76.m(div9, null);
    			append_dev(div9, t87);
    			if (if_block77) if_block77.m(div9, null);
    			append_dev(div9, t88);
    			if (if_block78) if_block78.m(div9, null);
    			append_dev(div11, t89);
    			append_dev(div11, div10);
    			append_dev(div10, span1);
    			if (if_block79) if_block79.m(span1, null);
    			append_dev(span1, t90);
    			if (if_block80) if_block80.m(span1, null);
    			append_dev(span1, t91);
    			if (if_block81) if_block81.m(span1, null);
    			append_dev(span1, t92);
    			if (if_block82) if_block82.m(span1, null);
    			append_dev(span1, t93);
    			if (if_block83) if_block83.m(span1, null);
    			append_dev(span1, t94);
    			if (if_block84) if_block84.m(span1, null);
    			append_dev(span1, t95);
    			if (if_block85) if_block85.m(span1, null);
    			append_dev(span1, t96);
    			if (if_block86) if_block86.m(span1, null);
    			append_dev(span1, t97);
    			if (if_block87) if_block87.m(span1, null);
    			append_dev(span1, t98);
    			if (if_block88) if_block88.m(span1, null);
    			append_dev(span1, t99);
    			if (if_block89) if_block89.m(span1, null);
    			append_dev(span1, t100);
    			if (if_block90) if_block90.m(span1, null);
    			append_dev(span1, t101);
    			if (if_block91) if_block91.m(span1, null);
    			append_dev(span1, t102);
    			if (if_block92) if_block92.m(span1, null);
    			append_dev(span1, t103);
    			if (if_block93) if_block93.m(span1, null);
    			append_dev(span1, t104);
    			if (if_block94) if_block94.m(span1, null);
    			append_dev(span1, t105);
    			if (if_block95) if_block95.m(span1, null);
    			append_dev(span1, t106);
    			if (if_block96) if_block96.m(span1, null);
    			append_dev(div11, t107);
    			if (if_block97) if_block97.m(div11, null);
    			append_dev(div11, t108);
    			if (if_block98) if_block98.m(div11, null);
    			append_dev(div11, t109);
    			if (if_block99) if_block99.m(div11, null);
    			append_dev(div11, t110);
    			if (if_block100) if_block100.m(div11, null);
    			append_dev(div11, t111);
    			if (if_block101) if_block101.m(div11, null);
    			append_dev(div11, t112);
    			if (if_block102) if_block102.m(div11, null);
    			append_dev(div11, t113);
    			if (if_block103) if_block103.m(div11, null);
    			append_dev(div11, t114);
    			if (if_block104) if_block104.m(div11, null);
    			append_dev(div11, t115);
    			if (if_block105) if_block105.m(div11, null);
    			append_dev(div11, t116);
    			if (if_block106) if_block106.m(div11, null);
    			append_dev(div11, t117);
    			if (if_block107) if_block107.m(div11, null);
    			append_dev(div11, t118);
    			if (if_block108) if_block108.m(div11, null);
    			append_dev(div11, t119);
    			if (if_block109) if_block109.m(div11, null);
    			append_dev(div11, t120);
    			if (if_block110) if_block110.m(div11, null);
    			append_dev(div11, t121);
    			if (if_block111) if_block111.m(div11, null);
    			append_dev(div11, t122);
    			if (if_block112) if_block112.m(div11, null);
    			append_dev(div11, t123);
    			if (if_block113) if_block113.m(div11, null);
    			append_dev(div11, t124);
    			if (if_block114) if_block114.m(div11, null);
    			append_dev(div11, t125);
    			if (if_block115) if_block115.m(div11, null);
    			append_dev(div11, t126);
    			if (if_block116) if_block116.m(div11, null);
    			append_dev(div11, t127);
    			if (if_block117) if_block117.m(div11, null);
    			append_dev(div11, t128);
    			if (if_block118) if_block118.m(div11, null);
    			append_dev(div11, t129);
    			if (if_block119) if_block119.m(div11, null);
    			append_dev(div11, t130);
    			if (if_block120) if_block120.m(div11, null);
    			append_dev(div11, t131);
    			if (if_block121) if_block121.m(div11, null);
    			append_dev(div11, t132);
    			if (if_block122) if_block122.m(div11, null);
    			insert_dev(target, t133, anchor);
    			insert_dev(target, div13, anchor);
    			append_dev(div13, div12);
    			append_dev(div12, img0);
    			append_dev(div12, br0);
    			append_dev(div12, br1);
    			append_dev(div12, t134);
    			append_dev(div12, br2);
    			append_dev(div12, br3);
    			append_dev(div12, t135);
    			append_dev(div12, i0);
    			append_dev(div12, br4);
    			append_dev(div12, t137);
    			append_dev(div12, br5);
    			append_dev(div12, t138);
    			append_dev(div12, br6);
    			append_dev(div12, br7);
    			append_dev(div12, t139);
    			append_dev(div12, i1);
    			append_dev(div12, br8);
    			append_dev(div12, t141);
    			append_dev(div12, br9);
    			append_dev(div12, t142);
    			append_dev(div12, br10);
    			append_dev(div12, br11);
    			append_dev(div12, t143);
    			append_dev(div12, span2);
    			append_dev(span2, i2);
    			append_dev(span2, br12);
    			append_dev(span2, t145);
    			append_dev(span2, i3);
    			append_dev(span2, t147);
    			append_dev(span2, br13);
    			append_dev(span2, t148);
    			append_dev(span2, br14);
    			append_dev(span2, t149);
    			append_dev(span2, br15);
    			append_dev(span2, t150);
    			append_dev(span2, br16);
    			append_dev(span2, t151);
    			append_dev(span2, br17);
    			append_dev(span2, br18);
    			append_dev(div12, t152);
    			append_dev(div12, i4);
    			append_dev(div12, br19);
    			append_dev(div12, t154);
    			append_dev(div12, br20);
    			insert_dev(target, t155, anchor);
    			insert_dev(target, div17, anchor);
    			append_dev(div17, div16);
    			append_dev(div16, div14);
    			append_dev(div14, img1);
    			append_dev(div14, br21);
    			append_dev(div14, br22);
    			append_dev(div14, t156);
    			append_dev(div14, br23);
    			append_dev(div14, br24);
    			append_dev(div14, t157);
    			append_dev(div14, i5);
    			append_dev(div14, br25);
    			append_dev(div14, t159);
    			append_dev(div14, br26);
    			append_dev(div14, t160);
    			append_dev(div14, br27);
    			append_dev(div14, br28);
    			append_dev(div14, t161);
    			append_dev(div14, span3);
    			append_dev(span3, i6);
    			append_dev(span3, br29);
    			append_dev(span3, t163);
    			append_dev(span3, i7);
    			append_dev(span3, t165);
    			append_dev(span3, br30);
    			append_dev(span3, t166);
    			append_dev(span3, br31);
    			append_dev(span3, t167);
    			append_dev(span3, br32);
    			append_dev(span3, t168);
    			append_dev(span3, br33);
    			append_dev(span3, t169);
    			append_dev(span3, br34);
    			append_dev(span3, br35);
    			append_dev(div14, t170);
    			append_dev(div14, i8);
    			append_dev(div14, br36);
    			append_dev(div14, t172);
    			append_dev(div14, br37);
    			append_dev(div14, t173);
    			append_dev(div14, span4);
    			append_dev(span4, br38);
    			append_dev(span4, br39);
    			append_dev(span4, t174);
    			append_dev(div16, t175);
    			append_dev(div16, br40);
    			append_dev(div16, br41);
    			append_dev(div16, br42);
    			append_dev(div16, br43);
    			append_dev(div16, t176);
    			if (if_block123) if_block123.m(div16, null);
    			append_dev(div16, t177);
    			if (if_block124) if_block124.m(div16, null);
    			append_dev(div16, t178);
    			if (if_block125) if_block125.m(div16, null);
    			append_dev(div16, t179);
    			if (if_block126) if_block126.m(div16, null);
    			append_dev(div16, t180);
    			if (if_block127) if_block127.m(div16, null);
    			append_dev(div16, t181);
    			if (if_block128) if_block128.m(div16, null);
    			append_dev(div16, t182);
    			if (if_block129) if_block129.m(div16, null);
    			append_dev(div16, t183);
    			if (if_block130) if_block130.m(div16, null);
    			append_dev(div16, t184);
    			if (if_block131) if_block131.m(div16, null);
    			append_dev(div16, t185);
    			if (if_block132) if_block132.m(div16, null);
    			append_dev(div16, t186);
    			if (if_block133) if_block133.m(div16, null);
    			append_dev(div16, t187);
    			if (if_block134) if_block134.m(div16, null);
    			append_dev(div16, t188);
    			if (if_block135) if_block135.m(div16, null);
    			append_dev(div16, t189);
    			if (if_block136) if_block136.m(div16, null);
    			append_dev(div16, t190);
    			if (if_block137) if_block137.m(div16, null);
    			append_dev(div16, t191);
    			if (if_block138) if_block138.m(div16, null);
    			append_dev(div16, t192);
    			if (if_block139) if_block139.m(div16, null);
    			append_dev(div16, t193);
    			if (if_block140) if_block140.m(div16, null);
    			append_dev(div16, t194);
    			if (if_block141) if_block141.m(div16, null);
    			append_dev(div16, t195);
    			if (if_block142) if_block142.m(div16, null);
    			append_dev(div16, t196);
    			if (if_block143) if_block143.m(div16, null);
    			append_dev(div16, t197);
    			if (if_block144) if_block144.m(div16, null);
    			append_dev(div16, t198);
    			if (if_block145) if_block145.m(div16, null);
    			append_dev(div16, t199);
    			append_dev(div16, div15);
    			append_dev(div16, t200);
    			if (if_block146) if_block146.m(div16, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div0, "click", /*toggleWEB*/ ctx[102], false, false, false),
    					listen_dev(div1, "click", /*togglePRINT*/ ctx[103], false, false, false),
    					listen_dev(div2, "click", /*toggleVIDEO*/ ctx[104], false, false, false),
    					listen_dev(div3, "click", /*toggleOTHER*/ ctx[105], false, false, false),
    					listen_dev(div4, "click", /*toggleALL*/ ctx[106], false, false, false),
    					listen_dev(div6, "click", /*click_handler*/ ctx[120], false, false, false),
    					listen_dev(div6, "click", /*toggleCollapse*/ ctx[107], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*frontscreen*/ ctx[1]) {
    				if (if_block0) ; else {
    					if_block0 = create_if_block_185(ctx);
    					if_block0.c();
    					if_block0.m(div7, t11);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*onourowntime*/ ctx[2]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_184(ctx);
    					if_block1.c();
    					if_block1.m(div7, t12);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*green*/ ctx[3]) {
    				if (if_block2) ; else {
    					if_block2 = create_if_block_183(ctx);
    					if_block2.c();
    					if_block2.m(div7, t13);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*viv*/ ctx[4]) {
    				if (if_block3) ; else {
    					if_block3 = create_if_block_182(ctx);
    					if_block3.c();
    					if_block3.m(div7, t14);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (/*portfolioio*/ ctx[7]) {
    				if (if_block4) ; else {
    					if_block4 = create_if_block_181(ctx);
    					if_block4.c();
    					if_block4.m(div7, t15);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (/*typoposters*/ ctx[5]) {
    				if (if_block5) ; else {
    					if_block5 = create_if_block_180(ctx);
    					if_block5.c();
    					if_block5.m(div7, t16);
    				}
    			} else if (if_block5) {
    				if_block5.d(1);
    				if_block5 = null;
    			}

    			if (/*beauimg*/ ctx[21]) {
    				if (if_block6) ; else {
    					if_block6 = create_if_block_179(ctx);
    					if_block6.c();
    					if_block6.m(div7, t17);
    				}
    			} else if (if_block6) {
    				if_block6.d(1);
    				if_block6 = null;
    			}

    			if (/*secret*/ ctx[6]) {
    				if (if_block7) ; else {
    					if_block7 = create_if_block_178(ctx);
    					if_block7.c();
    					if_block7.m(div7, t18);
    				}
    			} else if (if_block7) {
    				if_block7.d(1);
    				if_block7 = null;
    			}

    			if (/*sortedplastic*/ ctx[8]) {
    				if (if_block8) ; else {
    					if_block8 = create_if_block_177(ctx);
    					if_block8.c();
    					if_block8.m(div7, t19);
    				}
    			} else if (if_block8) {
    				if_block8.d(1);
    				if_block8 = null;
    			}

    			if (/*oeb*/ ctx[20]) {
    				if (if_block9) ; else {
    					if_block9 = create_if_block_176(ctx);
    					if_block9.c();
    					if_block9.m(div7, t20);
    				}
    			} else if (if_block9) {
    				if_block9.d(1);
    				if_block9 = null;
    			}

    			if (/*musicposters*/ ctx[9]) {
    				if (if_block10) ; else {
    					if_block10 = create_if_block_175(ctx);
    					if_block10.c();
    					if_block10.m(div7, t21);
    				}
    			} else if (if_block10) {
    				if_block10.d(1);
    				if_block10 = null;
    			}

    			if (/*timatal*/ ctx[10]) {
    				if (if_block11) ; else {
    					if_block11 = create_if_block_174(ctx);
    					if_block11.c();
    					if_block11.m(div7, t22);
    				}
    			} else if (if_block11) {
    				if_block11.d(1);
    				if_block11 = null;
    			}

    			if (/*tools*/ ctx[11]) {
    				if (if_block12) ; else {
    					if_block12 = create_if_block_173(ctx);
    					if_block12.c();
    					if_block12.m(div7, t23);
    				}
    			} else if (if_block12) {
    				if_block12.d(1);
    				if_block12 = null;
    			}

    			if (/*trash*/ ctx[12]) {
    				if (if_block13) ; else {
    					if_block13 = create_if_block_172(ctx);
    					if_block13.c();
    					if_block13.m(div7, t24);
    				}
    			} else if (if_block13) {
    				if_block13.d(1);
    				if_block13 = null;
    			}

    			if (/*musicbook*/ ctx[13]) {
    				if (if_block14) ; else {
    					if_block14 = create_if_block_171(ctx);
    					if_block14.c();
    					if_block14.m(div7, t25);
    				}
    			} else if (if_block14) {
    				if_block14.d(1);
    				if_block14 = null;
    			}

    			if (/*corruptedspace*/ ctx[14]) {
    				if (if_block15) ; else {
    					if_block15 = create_if_block_170(ctx);
    					if_block15.c();
    					if_block15.m(div7, t26);
    				}
    			} else if (if_block15) {
    				if_block15.d(1);
    				if_block15 = null;
    			}

    			if (/*oilbuddies*/ ctx[15]) {
    				if (if_block16) ; else {
    					if_block16 = create_if_block_169(ctx);
    					if_block16.c();
    					if_block16.m(div7, t27);
    				}
    			} else if (if_block16) {
    				if_block16.d(1);
    				if_block16 = null;
    			}

    			if (/*litabok*/ ctx[16]) {
    				if (if_block17) ; else {
    					if_block17 = create_if_block_168(ctx);
    					if_block17.c();
    					if_block17.m(div7, t28);
    				}
    			} else if (if_block17) {
    				if_block17.d(1);
    				if_block17 = null;
    			}

    			if (/*plastica*/ ctx[17]) {
    				if (if_block18) ; else {
    					if_block18 = create_if_block_167(ctx);
    					if_block18.c();
    					if_block18.m(div7, t29);
    				}
    			} else if (if_block18) {
    				if_block18.d(1);
    				if_block18 = null;
    			}

    			if (/*familiarfaces*/ ctx[18]) {
    				if (if_block19) ; else {
    					if_block19 = create_if_block_166(ctx);
    					if_block19.c();
    					if_block19.m(div7, t30);
    				}
    			} else if (if_block19) {
    				if_block19.d(1);
    				if_block19 = null;
    			}

    			if (/*likamar*/ ctx[19]) {
    				if (if_block20) ; else {
    					if_block20 = create_if_block_165(ctx);
    					if_block20.c();
    					if_block20.m(div7, t31);
    				}
    			} else if (if_block20) {
    				if_block20.d(1);
    				if_block20 = null;
    			}

    			if (/*bread*/ ctx[22]) {
    				if (if_block21) ; else {
    					if_block21 = create_if_block_164(ctx);
    					if_block21.c();
    					if_block21.m(div7, t32);
    				}
    			} else if (if_block21) {
    				if_block21.d(1);
    				if_block21 = null;
    			}

    			if (/*breadmag*/ ctx[24]) {
    				if (if_block22) ; else {
    					if_block22 = create_if_block_163(ctx);
    					if_block22.c();
    					if_block22.m(div7, t33);
    				}
    			} else if (if_block22) {
    				if_block22.d(1);
    				if_block22 = null;
    			}

    			if (/*flora*/ ctx[23]) {
    				if (if_block23) ; else {
    					if_block23 = create_if_block_162(ctx);
    					if_block23.c();
    					if_block23.m(div7, t34);
    				}
    			} else if (if_block23) {
    				if_block23.d(1);
    				if_block23 = null;
    			}

    			if (/*evublad*/ ctx[25]) {
    				if (if_block24) ; else {
    					if_block24 = create_if_block_161(ctx);
    					if_block24.c();
    					if_block24.m(div7, t35);
    				}
    			} else if (if_block24) {
    				if_block24.d(1);
    				if_block24 = null;
    			}

    			if (/*somalgors*/ ctx[26]) {
    				if (if_block25) ; else {
    					if_block25 = create_if_block_160(ctx);
    					if_block25.c();
    					if_block25.m(div7, t36);
    				}
    			} else if (if_block25) {
    				if_block25.d(1);
    				if_block25 = null;
    			}

    			if (/*organogram*/ ctx[27]) {
    				if (if_block26) ; else {
    					if_block26 = create_if_block_159(ctx);
    					if_block26.c();
    					if_block26.m(div7, null);
    				}
    			} else if (if_block26) {
    				if_block26.d(1);
    				if_block26 = null;
    			}

    			if (/*frontscreen*/ ctx[1]) {
    				if (if_block27) ; else {
    					if_block27 = create_if_block_158(ctx);
    					if_block27.c();
    					if_block27.m(span0, t38);
    				}
    			} else if (if_block27) {
    				if_block27.d(1);
    				if_block27 = null;
    			}

    			if (/*onourowntime*/ ctx[2]) {
    				if (if_block28) ; else {
    					if_block28 = create_if_block_157(ctx);
    					if_block28.c();
    					if_block28.m(span0, t39);
    				}
    			} else if (if_block28) {
    				if_block28.d(1);
    				if_block28 = null;
    			}

    			if (/*green*/ ctx[3]) {
    				if (if_block29) ; else {
    					if_block29 = create_if_block_156(ctx);
    					if_block29.c();
    					if_block29.m(span0, t40);
    				}
    			} else if (if_block29) {
    				if_block29.d(1);
    				if_block29 = null;
    			}

    			if (/*viv*/ ctx[4]) {
    				if (if_block30) ; else {
    					if_block30 = create_if_block_155(ctx);
    					if_block30.c();
    					if_block30.m(span0, t41);
    				}
    			} else if (if_block30) {
    				if_block30.d(1);
    				if_block30 = null;
    			}

    			if (/*bread*/ ctx[22]) {
    				if (if_block31) ; else {
    					if_block31 = create_if_block_154(ctx);
    					if_block31.c();
    					if_block31.m(span0, t42);
    				}
    			} else if (if_block31) {
    				if_block31.d(1);
    				if_block31 = null;
    			}

    			if (/*breadmag*/ ctx[24]) {
    				if (if_block32) ; else {
    					if_block32 = create_if_block_153(ctx);
    					if_block32.c();
    					if_block32.m(span0, t43);
    				}
    			} else if (if_block32) {
    				if_block32.d(1);
    				if_block32 = null;
    			}

    			if (/*portfolioio*/ ctx[7]) {
    				if (if_block33) ; else {
    					if_block33 = create_if_block_152(ctx);
    					if_block33.c();
    					if_block33.m(span0, t44);
    				}
    			} else if (if_block33) {
    				if_block33.d(1);
    				if_block33 = null;
    			}

    			if (/*typoposters*/ ctx[5]) {
    				if (if_block34) ; else {
    					if_block34 = create_if_block_151(ctx);
    					if_block34.c();
    					if_block34.m(span0, t45);
    				}
    			} else if (if_block34) {
    				if_block34.d(1);
    				if_block34 = null;
    			}

    			if (/*beauimg*/ ctx[21]) {
    				if (if_block35) ; else {
    					if_block35 = create_if_block_150(ctx);
    					if_block35.c();
    					if_block35.m(span0, t46);
    				}
    			} else if (if_block35) {
    				if_block35.d(1);
    				if_block35 = null;
    			}

    			if (/*secret*/ ctx[6]) {
    				if (if_block36) ; else {
    					if_block36 = create_if_block_149(ctx);
    					if_block36.c();
    					if_block36.m(span0, t47);
    				}
    			} else if (if_block36) {
    				if_block36.d(1);
    				if_block36 = null;
    			}

    			if (/*sortedplastic*/ ctx[8]) {
    				if (if_block37) ; else {
    					if_block37 = create_if_block_148(ctx);
    					if_block37.c();
    					if_block37.m(span0, t48);
    				}
    			} else if (if_block37) {
    				if_block37.d(1);
    				if_block37 = null;
    			}

    			if (/*oeb*/ ctx[20]) {
    				if (if_block38) ; else {
    					if_block38 = create_if_block_147(ctx);
    					if_block38.c();
    					if_block38.m(span0, t49);
    				}
    			} else if (if_block38) {
    				if_block38.d(1);
    				if_block38 = null;
    			}

    			if (/*musicposters*/ ctx[9]) {
    				if (if_block39) ; else {
    					if_block39 = create_if_block_146(ctx);
    					if_block39.c();
    					if_block39.m(span0, t50);
    				}
    			} else if (if_block39) {
    				if_block39.d(1);
    				if_block39 = null;
    			}

    			if (/*timatal*/ ctx[10]) {
    				if (if_block40) ; else {
    					if_block40 = create_if_block_145(ctx);
    					if_block40.c();
    					if_block40.m(span0, t51);
    				}
    			} else if (if_block40) {
    				if_block40.d(1);
    				if_block40 = null;
    			}

    			if (/*tools*/ ctx[11]) {
    				if (if_block41) ; else {
    					if_block41 = create_if_block_144(ctx);
    					if_block41.c();
    					if_block41.m(span0, t52);
    				}
    			} else if (if_block41) {
    				if_block41.d(1);
    				if_block41 = null;
    			}

    			if (/*trash*/ ctx[12]) {
    				if (if_block42) ; else {
    					if_block42 = create_if_block_143(ctx);
    					if_block42.c();
    					if_block42.m(span0, t53);
    				}
    			} else if (if_block42) {
    				if_block42.d(1);
    				if_block42 = null;
    			}

    			if (/*musicbook*/ ctx[13]) {
    				if (if_block43) ; else {
    					if_block43 = create_if_block_142(ctx);
    					if_block43.c();
    					if_block43.m(span0, t54);
    				}
    			} else if (if_block43) {
    				if_block43.d(1);
    				if_block43 = null;
    			}

    			if (/*corruptedspace*/ ctx[14]) {
    				if (if_block44) ; else {
    					if_block44 = create_if_block_141(ctx);
    					if_block44.c();
    					if_block44.m(span0, t55);
    				}
    			} else if (if_block44) {
    				if_block44.d(1);
    				if_block44 = null;
    			}

    			if (/*oilbuddies*/ ctx[15]) {
    				if (if_block45) ; else {
    					if_block45 = create_if_block_140(ctx);
    					if_block45.c();
    					if_block45.m(span0, t56);
    				}
    			} else if (if_block45) {
    				if_block45.d(1);
    				if_block45 = null;
    			}

    			if (/*litabok*/ ctx[16]) {
    				if (if_block46) ; else {
    					if_block46 = create_if_block_139(ctx);
    					if_block46.c();
    					if_block46.m(span0, t57);
    				}
    			} else if (if_block46) {
    				if_block46.d(1);
    				if_block46 = null;
    			}

    			if (/*plastica*/ ctx[17]) {
    				if (if_block47) ; else {
    					if_block47 = create_if_block_138(ctx);
    					if_block47.c();
    					if_block47.m(span0, t58);
    				}
    			} else if (if_block47) {
    				if_block47.d(1);
    				if_block47 = null;
    			}

    			if (/*familiarfaces*/ ctx[18]) {
    				if (if_block48) ; else {
    					if_block48 = create_if_block_137(ctx);
    					if_block48.c();
    					if_block48.m(span0, t59);
    				}
    			} else if (if_block48) {
    				if_block48.d(1);
    				if_block48 = null;
    			}

    			if (/*likamar*/ ctx[19]) {
    				if (if_block49) ; else {
    					if_block49 = create_if_block_136(ctx);
    					if_block49.c();
    					if_block49.m(span0, t60);
    				}
    			} else if (if_block49) {
    				if_block49.d(1);
    				if_block49 = null;
    			}

    			if (/*flora*/ ctx[23]) {
    				if (if_block50) ; else {
    					if_block50 = create_if_block_135(ctx);
    					if_block50.c();
    					if_block50.m(span0, t61);
    				}
    			} else if (if_block50) {
    				if_block50.d(1);
    				if_block50 = null;
    			}

    			if (/*evublad*/ ctx[25]) {
    				if (if_block51) ; else {
    					if_block51 = create_if_block_134(ctx);
    					if_block51.c();
    					if_block51.m(span0, null);
    				}
    			} else if (if_block51) {
    				if_block51.d(1);
    				if_block51 = null;
    			}

    			if (/*frontscreen*/ ctx[1]) {
    				if (if_block52) ; else {
    					if_block52 = create_if_block_133(ctx);
    					if_block52.c();
    					if_block52.m(div9, t63);
    				}
    			} else if (if_block52) {
    				if_block52.d(1);
    				if_block52 = null;
    			}

    			if (/*onourowntime*/ ctx[2]) {
    				if (if_block53) ; else {
    					if_block53 = create_if_block_132(ctx);
    					if_block53.c();
    					if_block53.m(div9, t64);
    				}
    			} else if (if_block53) {
    				if_block53.d(1);
    				if_block53 = null;
    			}

    			if (/*green*/ ctx[3]) {
    				if (if_block54) ; else {
    					if_block54 = create_if_block_131(ctx);
    					if_block54.c();
    					if_block54.m(div9, t65);
    				}
    			} else if (if_block54) {
    				if_block54.d(1);
    				if_block54 = null;
    			}

    			if (/*viv*/ ctx[4]) {
    				if (if_block55) ; else {
    					if_block55 = create_if_block_130(ctx);
    					if_block55.c();
    					if_block55.m(div9, t66);
    				}
    			} else if (if_block55) {
    				if_block55.d(1);
    				if_block55 = null;
    			}

    			if (/*bread*/ ctx[22]) {
    				if (if_block56) ; else {
    					if_block56 = create_if_block_129(ctx);
    					if_block56.c();
    					if_block56.m(div9, t67);
    				}
    			} else if (if_block56) {
    				if_block56.d(1);
    				if_block56 = null;
    			}

    			if (/*breadmag*/ ctx[24]) {
    				if (if_block57) ; else {
    					if_block57 = create_if_block_128(ctx);
    					if_block57.c();
    					if_block57.m(div9, t68);
    				}
    			} else if (if_block57) {
    				if_block57.d(1);
    				if_block57 = null;
    			}

    			if (/*portfolioio*/ ctx[7]) {
    				if (if_block58) ; else {
    					if_block58 = create_if_block_127(ctx);
    					if_block58.c();
    					if_block58.m(div9, t69);
    				}
    			} else if (if_block58) {
    				if_block58.d(1);
    				if_block58 = null;
    			}

    			if (/*typoposters*/ ctx[5]) {
    				if (if_block59) ; else {
    					if_block59 = create_if_block_126(ctx);
    					if_block59.c();
    					if_block59.m(div9, t70);
    				}
    			} else if (if_block59) {
    				if_block59.d(1);
    				if_block59 = null;
    			}

    			if (/*beauimg*/ ctx[21]) {
    				if (if_block60) ; else {
    					if_block60 = create_if_block_125(ctx);
    					if_block60.c();
    					if_block60.m(div9, t71);
    				}
    			} else if (if_block60) {
    				if_block60.d(1);
    				if_block60 = null;
    			}

    			if (/*secret*/ ctx[6]) {
    				if (if_block61) ; else {
    					if_block61 = create_if_block_124(ctx);
    					if_block61.c();
    					if_block61.m(div9, t72);
    				}
    			} else if (if_block61) {
    				if_block61.d(1);
    				if_block61 = null;
    			}

    			if (/*sortedplastic*/ ctx[8]) {
    				if (if_block62) ; else {
    					if_block62 = create_if_block_123(ctx);
    					if_block62.c();
    					if_block62.m(div9, t73);
    				}
    			} else if (if_block62) {
    				if_block62.d(1);
    				if_block62 = null;
    			}

    			if (/*oeb*/ ctx[20]) {
    				if (if_block63) ; else {
    					if_block63 = create_if_block_122(ctx);
    					if_block63.c();
    					if_block63.m(div9, t74);
    				}
    			} else if (if_block63) {
    				if_block63.d(1);
    				if_block63 = null;
    			}

    			if (/*musicposters*/ ctx[9]) {
    				if (if_block64) ; else {
    					if_block64 = create_if_block_121(ctx);
    					if_block64.c();
    					if_block64.m(div9, t75);
    				}
    			} else if (if_block64) {
    				if_block64.d(1);
    				if_block64 = null;
    			}

    			if (/*timatal*/ ctx[10]) {
    				if (if_block65) ; else {
    					if_block65 = create_if_block_120(ctx);
    					if_block65.c();
    					if_block65.m(div9, t76);
    				}
    			} else if (if_block65) {
    				if_block65.d(1);
    				if_block65 = null;
    			}

    			if (/*tools*/ ctx[11]) {
    				if (if_block66) ; else {
    					if_block66 = create_if_block_119(ctx);
    					if_block66.c();
    					if_block66.m(div9, t77);
    				}
    			} else if (if_block66) {
    				if_block66.d(1);
    				if_block66 = null;
    			}

    			if (/*trash*/ ctx[12]) {
    				if (if_block67) ; else {
    					if_block67 = create_if_block_118(ctx);
    					if_block67.c();
    					if_block67.m(div9, t78);
    				}
    			} else if (if_block67) {
    				if_block67.d(1);
    				if_block67 = null;
    			}

    			if (/*musicbook*/ ctx[13]) {
    				if (if_block68) ; else {
    					if_block68 = create_if_block_117(ctx);
    					if_block68.c();
    					if_block68.m(div9, t79);
    				}
    			} else if (if_block68) {
    				if_block68.d(1);
    				if_block68 = null;
    			}

    			if (/*corruptedspace*/ ctx[14]) {
    				if (if_block69) ; else {
    					if_block69 = create_if_block_116(ctx);
    					if_block69.c();
    					if_block69.m(div9, t80);
    				}
    			} else if (if_block69) {
    				if_block69.d(1);
    				if_block69 = null;
    			}

    			if (/*oilbuddies*/ ctx[15]) {
    				if (if_block70) ; else {
    					if_block70 = create_if_block_115(ctx);
    					if_block70.c();
    					if_block70.m(div9, t81);
    				}
    			} else if (if_block70) {
    				if_block70.d(1);
    				if_block70 = null;
    			}

    			if (/*litabok*/ ctx[16]) {
    				if (if_block71) ; else {
    					if_block71 = create_if_block_114(ctx);
    					if_block71.c();
    					if_block71.m(div9, t82);
    				}
    			} else if (if_block71) {
    				if_block71.d(1);
    				if_block71 = null;
    			}

    			if (/*plastica*/ ctx[17]) {
    				if (if_block72) ; else {
    					if_block72 = create_if_block_113(ctx);
    					if_block72.c();
    					if_block72.m(div9, t83);
    				}
    			} else if (if_block72) {
    				if_block72.d(1);
    				if_block72 = null;
    			}

    			if (/*familiarfaces*/ ctx[18]) {
    				if (if_block73) ; else {
    					if_block73 = create_if_block_112(ctx);
    					if_block73.c();
    					if_block73.m(div9, t84);
    				}
    			} else if (if_block73) {
    				if_block73.d(1);
    				if_block73 = null;
    			}

    			if (/*likamar*/ ctx[19]) {
    				if (if_block74) ; else {
    					if_block74 = create_if_block_111(ctx);
    					if_block74.c();
    					if_block74.m(div9, t85);
    				}
    			} else if (if_block74) {
    				if_block74.d(1);
    				if_block74 = null;
    			}

    			if (/*flora*/ ctx[23]) {
    				if (if_block75) ; else {
    					if_block75 = create_if_block_110(ctx);
    					if_block75.c();
    					if_block75.m(div9, t86);
    				}
    			} else if (if_block75) {
    				if_block75.d(1);
    				if_block75 = null;
    			}

    			if (/*evublad*/ ctx[25]) {
    				if (if_block76) ; else {
    					if_block76 = create_if_block_109(ctx);
    					if_block76.c();
    					if_block76.m(div9, t87);
    				}
    			} else if (if_block76) {
    				if_block76.d(1);
    				if_block76 = null;
    			}

    			if (/*somalgors*/ ctx[26]) {
    				if (if_block77) ; else {
    					if_block77 = create_if_block_108(ctx);
    					if_block77.c();
    					if_block77.m(div9, t88);
    				}
    			} else if (if_block77) {
    				if_block77.d(1);
    				if_block77 = null;
    			}

    			if (/*organogram*/ ctx[27]) {
    				if (if_block78) ; else {
    					if_block78 = create_if_block_107(ctx);
    					if_block78.c();
    					if_block78.m(div9, null);
    				}
    			} else if (if_block78) {
    				if_block78.d(1);
    				if_block78 = null;
    			}

    			if (/*frontscreen*/ ctx[1]) {
    				if (if_block79) ; else {
    					if_block79 = create_if_block_106(ctx);
    					if_block79.c();
    					if_block79.m(span1, t90);
    				}
    			} else if (if_block79) {
    				if_block79.d(1);
    				if_block79 = null;
    			}

    			if (/*onourowntime*/ ctx[2]) {
    				if (if_block80) ; else {
    					if_block80 = create_if_block_105(ctx);
    					if_block80.c();
    					if_block80.m(span1, t91);
    				}
    			} else if (if_block80) {
    				if_block80.d(1);
    				if_block80 = null;
    			}

    			if (/*viv*/ ctx[4]) {
    				if (if_block81) ; else {
    					if_block81 = create_if_block_104(ctx);
    					if_block81.c();
    					if_block81.m(span1, t92);
    				}
    			} else if (if_block81) {
    				if_block81.d(1);
    				if_block81 = null;
    			}

    			if (/*typoposters*/ ctx[5]) {
    				if (if_block82) ; else {
    					if_block82 = create_if_block_103(ctx);
    					if_block82.c();
    					if_block82.m(span1, t93);
    				}
    			} else if (if_block82) {
    				if_block82.d(1);
    				if_block82 = null;
    			}

    			if (/*secret*/ ctx[6]) {
    				if (if_block83) ; else {
    					if_block83 = create_if_block_102(ctx);
    					if_block83.c();
    					if_block83.m(span1, t94);
    				}
    			} else if (if_block83) {
    				if_block83.d(1);
    				if_block83 = null;
    			}

    			if (/*tools*/ ctx[11]) {
    				if (if_block84) ; else {
    					if_block84 = create_if_block_101(ctx);
    					if_block84.c();
    					if_block84.m(span1, t95);
    				}
    			} else if (if_block84) {
    				if_block84.d(1);
    				if_block84 = null;
    			}

    			if (/*timatal*/ ctx[10]) {
    				if (if_block85) ; else {
    					if_block85 = create_if_block_100(ctx);
    					if_block85.c();
    					if_block85.m(span1, t96);
    				}
    			} else if (if_block85) {
    				if_block85.d(1);
    				if_block85 = null;
    			}

    			if (/*sortedplastic*/ ctx[8]) {
    				if (if_block86) ; else {
    					if_block86 = create_if_block_99(ctx);
    					if_block86.c();
    					if_block86.m(span1, t97);
    				}
    			} else if (if_block86) {
    				if_block86.d(1);
    				if_block86 = null;
    			}

    			if (/*litabok*/ ctx[16]) {
    				if (if_block87) ; else {
    					if_block87 = create_if_block_98(ctx);
    					if_block87.c();
    					if_block87.m(span1, t98);
    				}
    			} else if (if_block87) {
    				if_block87.d(1);
    				if_block87 = null;
    			}

    			if (/*oilbuddies*/ ctx[15]) {
    				if (if_block88) ; else {
    					if_block88 = create_if_block_97(ctx);
    					if_block88.c();
    					if_block88.m(span1, t99);
    				}
    			} else if (if_block88) {
    				if_block88.d(1);
    				if_block88 = null;
    			}

    			if (/*trash*/ ctx[12]) {
    				if (if_block89) ; else {
    					if_block89 = create_if_block_96(ctx);
    					if_block89.c();
    					if_block89.m(span1, t100);
    				}
    			} else if (if_block89) {
    				if_block89.d(1);
    				if_block89 = null;
    			}

    			if (/*familiarfaces*/ ctx[18]) {
    				if (if_block90) ; else {
    					if_block90 = create_if_block_95(ctx);
    					if_block90.c();
    					if_block90.m(span1, t101);
    				}
    			} else if (if_block90) {
    				if_block90.d(1);
    				if_block90 = null;
    			}

    			if (/*musicbook*/ ctx[13]) {
    				if (if_block91) ; else {
    					if_block91 = create_if_block_94(ctx);
    					if_block91.c();
    					if_block91.m(span1, t102);
    				}
    			} else if (if_block91) {
    				if_block91.d(1);
    				if_block91 = null;
    			}

    			if (/*plastica*/ ctx[17]) {
    				if (if_block92) ; else {
    					if_block92 = create_if_block_93(ctx);
    					if_block92.c();
    					if_block92.m(span1, t103);
    				}
    			} else if (if_block92) {
    				if_block92.d(1);
    				if_block92 = null;
    			}

    			if (/*corruptedspace*/ ctx[14]) {
    				if (if_block93) ; else {
    					if_block93 = create_if_block_92(ctx);
    					if_block93.c();
    					if_block93.m(span1, t104);
    				}
    			} else if (if_block93) {
    				if_block93.d(1);
    				if_block93 = null;
    			}

    			if (/*likamar*/ ctx[19]) {
    				if (if_block94) ; else {
    					if_block94 = create_if_block_91(ctx);
    					if_block94.c();
    					if_block94.m(span1, t105);
    				}
    			} else if (if_block94) {
    				if_block94.d(1);
    				if_block94 = null;
    			}

    			if (/*green*/ ctx[3]) {
    				if (if_block95) ; else {
    					if_block95 = create_if_block_90(ctx);
    					if_block95.c();
    					if_block95.m(span1, t106);
    				}
    			} else if (if_block95) {
    				if_block95.d(1);
    				if_block95 = null;
    			}

    			if (/*evublad*/ ctx[25]) {
    				if (if_block96) ; else {
    					if_block96 = create_if_block_89(ctx);
    					if_block96.c();
    					if_block96.m(span1, null);
    				}
    			} else if (if_block96) {
    				if_block96.d(1);
    				if_block96 = null;
    			}

    			if (/*onourowntime*/ ctx[2]) {
    				if (if_block97) {
    					if (dirty[0] & /*onourowntime*/ 4) {
    						transition_in(if_block97, 1);
    					}
    				} else {
    					if_block97 = create_if_block_88(ctx);
    					if_block97.c();
    					transition_in(if_block97, 1);
    					if_block97.m(div11, t108);
    				}
    			} else if (if_block97) {
    				group_outros();

    				transition_out(if_block97, 1, 1, () => {
    					if_block97 = null;
    				});

    				check_outros();
    			}

    			if (/*green*/ ctx[3]) {
    				if (if_block98) {
    					if (dirty[0] & /*green*/ 8) {
    						transition_in(if_block98, 1);
    					}
    				} else {
    					if_block98 = create_if_block_87(ctx);
    					if_block98.c();
    					transition_in(if_block98, 1);
    					if_block98.m(div11, t109);
    				}
    			} else if (if_block98) {
    				group_outros();

    				transition_out(if_block98, 1, 1, () => {
    					if_block98 = null;
    				});

    				check_outros();
    			}

    			if (/*viv*/ ctx[4]) {
    				if (if_block99) {
    					if (dirty[0] & /*viv*/ 16) {
    						transition_in(if_block99, 1);
    					}
    				} else {
    					if_block99 = create_if_block_86(ctx);
    					if_block99.c();
    					transition_in(if_block99, 1);
    					if_block99.m(div11, t110);
    				}
    			} else if (if_block99) {
    				group_outros();

    				transition_out(if_block99, 1, 1, () => {
    					if_block99 = null;
    				});

    				check_outros();
    			}

    			if (/*portfolioio*/ ctx[7]) {
    				if (if_block100) {
    					if (dirty[0] & /*portfolioio*/ 128) {
    						transition_in(if_block100, 1);
    					}
    				} else {
    					if_block100 = create_if_block_85(ctx);
    					if_block100.c();
    					transition_in(if_block100, 1);
    					if_block100.m(div11, t111);
    				}
    			} else if (if_block100) {
    				group_outros();

    				transition_out(if_block100, 1, 1, () => {
    					if_block100 = null;
    				});

    				check_outros();
    			}

    			if (/*typoposters*/ ctx[5]) {
    				if (if_block101) {
    					if (dirty[0] & /*typoposters*/ 32) {
    						transition_in(if_block101, 1);
    					}
    				} else {
    					if_block101 = create_if_block_84(ctx);
    					if_block101.c();
    					transition_in(if_block101, 1);
    					if_block101.m(div11, t112);
    				}
    			} else if (if_block101) {
    				group_outros();

    				transition_out(if_block101, 1, 1, () => {
    					if_block101 = null;
    				});

    				check_outros();
    			}

    			if (/*secret*/ ctx[6]) {
    				if (if_block102) {
    					if (dirty[0] & /*secret*/ 64) {
    						transition_in(if_block102, 1);
    					}
    				} else {
    					if_block102 = create_if_block_83(ctx);
    					if_block102.c();
    					transition_in(if_block102, 1);
    					if_block102.m(div11, t113);
    				}
    			} else if (if_block102) {
    				group_outros();

    				transition_out(if_block102, 1, 1, () => {
    					if_block102 = null;
    				});

    				check_outros();
    			}

    			if (/*sortedplastic*/ ctx[8]) {
    				if (if_block103) {
    					if (dirty[0] & /*sortedplastic*/ 256) {
    						transition_in(if_block103, 1);
    					}
    				} else {
    					if_block103 = create_if_block_82(ctx);
    					if_block103.c();
    					transition_in(if_block103, 1);
    					if_block103.m(div11, t114);
    				}
    			} else if (if_block103) {
    				group_outros();

    				transition_out(if_block103, 1, 1, () => {
    					if_block103 = null;
    				});

    				check_outros();
    			}

    			if (/*musicposters*/ ctx[9]) {
    				if (if_block104) {
    					if (dirty[0] & /*musicposters*/ 512) {
    						transition_in(if_block104, 1);
    					}
    				} else {
    					if_block104 = create_if_block_81(ctx);
    					if_block104.c();
    					transition_in(if_block104, 1);
    					if_block104.m(div11, t115);
    				}
    			} else if (if_block104) {
    				group_outros();

    				transition_out(if_block104, 1, 1, () => {
    					if_block104 = null;
    				});

    				check_outros();
    			}

    			if (/*timatal*/ ctx[10]) {
    				if (if_block105) {
    					if (dirty[0] & /*timatal*/ 1024) {
    						transition_in(if_block105, 1);
    					}
    				} else {
    					if_block105 = create_if_block_80(ctx);
    					if_block105.c();
    					transition_in(if_block105, 1);
    					if_block105.m(div11, t116);
    				}
    			} else if (if_block105) {
    				group_outros();

    				transition_out(if_block105, 1, 1, () => {
    					if_block105 = null;
    				});

    				check_outros();
    			}

    			if (/*tools*/ ctx[11]) {
    				if (if_block106) {
    					if (dirty[0] & /*tools*/ 2048) {
    						transition_in(if_block106, 1);
    					}
    				} else {
    					if_block106 = create_if_block_79(ctx);
    					if_block106.c();
    					transition_in(if_block106, 1);
    					if_block106.m(div11, t117);
    				}
    			} else if (if_block106) {
    				group_outros();

    				transition_out(if_block106, 1, 1, () => {
    					if_block106 = null;
    				});

    				check_outros();
    			}

    			if (/*trash*/ ctx[12]) {
    				if (if_block107) {
    					if (dirty[0] & /*trash*/ 4096) {
    						transition_in(if_block107, 1);
    					}
    				} else {
    					if_block107 = create_if_block_78(ctx);
    					if_block107.c();
    					transition_in(if_block107, 1);
    					if_block107.m(div11, t118);
    				}
    			} else if (if_block107) {
    				group_outros();

    				transition_out(if_block107, 1, 1, () => {
    					if_block107 = null;
    				});

    				check_outros();
    			}

    			if (/*musicbook*/ ctx[13]) {
    				if (if_block108) {
    					if (dirty[0] & /*musicbook*/ 8192) {
    						transition_in(if_block108, 1);
    					}
    				} else {
    					if_block108 = create_if_block_77(ctx);
    					if_block108.c();
    					transition_in(if_block108, 1);
    					if_block108.m(div11, t119);
    				}
    			} else if (if_block108) {
    				group_outros();

    				transition_out(if_block108, 1, 1, () => {
    					if_block108 = null;
    				});

    				check_outros();
    			}

    			if (/*corruptedspace*/ ctx[14]) {
    				if (if_block109) {
    					if (dirty[0] & /*corruptedspace*/ 16384) {
    						transition_in(if_block109, 1);
    					}
    				} else {
    					if_block109 = create_if_block_76(ctx);
    					if_block109.c();
    					transition_in(if_block109, 1);
    					if_block109.m(div11, t120);
    				}
    			} else if (if_block109) {
    				group_outros();

    				transition_out(if_block109, 1, 1, () => {
    					if_block109 = null;
    				});

    				check_outros();
    			}

    			if (/*oilbuddies*/ ctx[15]) {
    				if (if_block110) {
    					if (dirty[0] & /*oilbuddies*/ 32768) {
    						transition_in(if_block110, 1);
    					}
    				} else {
    					if_block110 = create_if_block_75(ctx);
    					if_block110.c();
    					transition_in(if_block110, 1);
    					if_block110.m(div11, t121);
    				}
    			} else if (if_block110) {
    				group_outros();

    				transition_out(if_block110, 1, 1, () => {
    					if_block110 = null;
    				});

    				check_outros();
    			}

    			if (/*litabok*/ ctx[16]) {
    				if (if_block111) {
    					if (dirty[0] & /*litabok*/ 65536) {
    						transition_in(if_block111, 1);
    					}
    				} else {
    					if_block111 = create_if_block_74(ctx);
    					if_block111.c();
    					transition_in(if_block111, 1);
    					if_block111.m(div11, t122);
    				}
    			} else if (if_block111) {
    				group_outros();

    				transition_out(if_block111, 1, 1, () => {
    					if_block111 = null;
    				});

    				check_outros();
    			}

    			if (/*plastica*/ ctx[17]) {
    				if (if_block112) {
    					if (dirty[0] & /*plastica*/ 131072) {
    						transition_in(if_block112, 1);
    					}
    				} else {
    					if_block112 = create_if_block_73(ctx);
    					if_block112.c();
    					transition_in(if_block112, 1);
    					if_block112.m(div11, t123);
    				}
    			} else if (if_block112) {
    				group_outros();

    				transition_out(if_block112, 1, 1, () => {
    					if_block112 = null;
    				});

    				check_outros();
    			}

    			if (/*familiarfaces*/ ctx[18]) {
    				if (if_block113) {
    					if (dirty[0] & /*familiarfaces*/ 262144) {
    						transition_in(if_block113, 1);
    					}
    				} else {
    					if_block113 = create_if_block_72(ctx);
    					if_block113.c();
    					transition_in(if_block113, 1);
    					if_block113.m(div11, t124);
    				}
    			} else if (if_block113) {
    				group_outros();

    				transition_out(if_block113, 1, 1, () => {
    					if_block113 = null;
    				});

    				check_outros();
    			}

    			if (/*likamar*/ ctx[19]) {
    				if (if_block114) {
    					if (dirty[0] & /*likamar*/ 524288) {
    						transition_in(if_block114, 1);
    					}
    				} else {
    					if_block114 = create_if_block_71(ctx);
    					if_block114.c();
    					transition_in(if_block114, 1);
    					if_block114.m(div11, t125);
    				}
    			} else if (if_block114) {
    				group_outros();

    				transition_out(if_block114, 1, 1, () => {
    					if_block114 = null;
    				});

    				check_outros();
    			}

    			if (/*oeb*/ ctx[20]) {
    				if (if_block115) {
    					if (dirty[0] & /*oeb*/ 1048576) {
    						transition_in(if_block115, 1);
    					}
    				} else {
    					if_block115 = create_if_block_70(ctx);
    					if_block115.c();
    					transition_in(if_block115, 1);
    					if_block115.m(div11, t126);
    				}
    			} else if (if_block115) {
    				group_outros();

    				transition_out(if_block115, 1, 1, () => {
    					if_block115 = null;
    				});

    				check_outros();
    			}

    			if (/*beauimg*/ ctx[21]) {
    				if (if_block116) {
    					if (dirty[0] & /*beauimg*/ 2097152) {
    						transition_in(if_block116, 1);
    					}
    				} else {
    					if_block116 = create_if_block_69(ctx);
    					if_block116.c();
    					transition_in(if_block116, 1);
    					if_block116.m(div11, t127);
    				}
    			} else if (if_block116) {
    				group_outros();

    				transition_out(if_block116, 1, 1, () => {
    					if_block116 = null;
    				});

    				check_outros();
    			}

    			if (/*bread*/ ctx[22]) {
    				if (if_block117) {
    					if (dirty[0] & /*bread*/ 4194304) {
    						transition_in(if_block117, 1);
    					}
    				} else {
    					if_block117 = create_if_block_68(ctx);
    					if_block117.c();
    					transition_in(if_block117, 1);
    					if_block117.m(div11, t128);
    				}
    			} else if (if_block117) {
    				group_outros();

    				transition_out(if_block117, 1, 1, () => {
    					if_block117 = null;
    				});

    				check_outros();
    			}

    			if (/*flora*/ ctx[23]) {
    				if (if_block118) {
    					if (dirty[0] & /*flora*/ 8388608) {
    						transition_in(if_block118, 1);
    					}
    				} else {
    					if_block118 = create_if_block_67(ctx);
    					if_block118.c();
    					transition_in(if_block118, 1);
    					if_block118.m(div11, t129);
    				}
    			} else if (if_block118) {
    				group_outros();

    				transition_out(if_block118, 1, 1, () => {
    					if_block118 = null;
    				});

    				check_outros();
    			}

    			if (/*breadmag*/ ctx[24]) {
    				if (if_block119) {
    					if (dirty[0] & /*breadmag*/ 16777216) {
    						transition_in(if_block119, 1);
    					}
    				} else {
    					if_block119 = create_if_block_66(ctx);
    					if_block119.c();
    					transition_in(if_block119, 1);
    					if_block119.m(div11, t130);
    				}
    			} else if (if_block119) {
    				group_outros();

    				transition_out(if_block119, 1, 1, () => {
    					if_block119 = null;
    				});

    				check_outros();
    			}

    			if (/*evublad*/ ctx[25]) {
    				if (if_block120) {
    					if (dirty[0] & /*evublad*/ 33554432) {
    						transition_in(if_block120, 1);
    					}
    				} else {
    					if_block120 = create_if_block_65(ctx);
    					if_block120.c();
    					transition_in(if_block120, 1);
    					if_block120.m(div11, t131);
    				}
    			} else if (if_block120) {
    				group_outros();

    				transition_out(if_block120, 1, 1, () => {
    					if_block120 = null;
    				});

    				check_outros();
    			}

    			if (/*somalgors*/ ctx[26]) {
    				if (if_block121) {
    					if (dirty[0] & /*somalgors*/ 67108864) {
    						transition_in(if_block121, 1);
    					}
    				} else {
    					if_block121 = create_if_block_64(ctx);
    					if_block121.c();
    					transition_in(if_block121, 1);
    					if_block121.m(div11, t132);
    				}
    			} else if (if_block121) {
    				group_outros();

    				transition_out(if_block121, 1, 1, () => {
    					if_block121 = null;
    				});

    				check_outros();
    			}

    			if (/*organogram*/ ctx[27]) {
    				if (if_block122) {
    					if (dirty[0] & /*organogram*/ 134217728) {
    						transition_in(if_block122, 1);
    					}
    				} else {
    					if_block122 = create_if_block_63(ctx);
    					if_block122.c();
    					transition_in(if_block122, 1);
    					if_block122.m(div11, null);
    				}
    			} else if (if_block122) {
    				group_outros();

    				transition_out(if_block122, 1, 1, () => {
    					if_block122 = null;
    				});

    				check_outros();
    			}

    			if (dirty[0] & /*expand*/ 1) {
    				toggle_class(div11, "expand", /*expand*/ ctx[0]);
    			}

    			if (/*PICflora*/ ctx[49]) {
    				if (if_block123) {
    					if_block123.p(ctx, dirty);
    				} else {
    					if_block123 = create_if_block_62(ctx);
    					if_block123.c();
    					if_block123.m(div16, t177);
    				}
    			} else if (if_block123) {
    				if_block123.d(1);
    				if_block123 = null;
    			}

    			if (/*PIConourowntime*/ ctx[28]) {
    				if (if_block124) {
    					if_block124.p(ctx, dirty);
    				} else {
    					if_block124 = create_if_block_61(ctx);
    					if_block124.c();
    					if_block124.m(div16, t178);
    				}
    			} else if (if_block124) {
    				if_block124.d(1);
    				if_block124 = null;
    			}

    			if (/*PICgreen*/ ctx[29]) {
    				if (if_block125) {
    					if_block125.p(ctx, dirty);
    				} else {
    					if_block125 = create_if_block_60(ctx);
    					if_block125.c();
    					if_block125.m(div16, t179);
    				}
    			} else if (if_block125) {
    				if_block125.d(1);
    				if_block125 = null;
    			}

    			if (/*PICviv*/ ctx[30]) {
    				if (if_block126) {
    					if_block126.p(ctx, dirty);
    				} else {
    					if_block126 = create_if_block_59(ctx);
    					if_block126.c();
    					if_block126.m(div16, t180);
    				}
    			} else if (if_block126) {
    				if_block126.d(1);
    				if_block126 = null;
    			}

    			if (/*PICbread*/ ctx[48]) {
    				if (if_block127) {
    					if_block127.p(ctx, dirty);
    				} else {
    					if_block127 = create_if_block_58(ctx);
    					if_block127.c();
    					if_block127.m(div16, t181);
    				}
    			} else if (if_block127) {
    				if_block127.d(1);
    				if_block127 = null;
    			}

    			if (/*PICbreadmag*/ ctx[50]) {
    				if (if_block128) {
    					if_block128.p(ctx, dirty);
    				} else {
    					if_block128 = create_if_block_57(ctx);
    					if_block128.c();
    					if_block128.m(div16, t182);
    				}
    			} else if (if_block128) {
    				if_block128.d(1);
    				if_block128 = null;
    			}

    			if (/*PICportfolioio*/ ctx[33]) {
    				if (if_block129) {
    					if_block129.p(ctx, dirty);
    				} else {
    					if_block129 = create_if_block_56(ctx);
    					if_block129.c();
    					if_block129.m(div16, t183);
    				}
    			} else if (if_block129) {
    				if_block129.d(1);
    				if_block129 = null;
    			}

    			if (/*PICbeauimg*/ ctx[47]) {
    				if (if_block130) {
    					if_block130.p(ctx, dirty);
    				} else {
    					if_block130 = create_if_block_55(ctx);
    					if_block130.c();
    					if_block130.m(div16, t184);
    				}
    			} else if (if_block130) {
    				if_block130.d(1);
    				if_block130 = null;
    			}

    			if (/*PICtypoposters*/ ctx[31]) {
    				if (if_block131) {
    					if_block131.p(ctx, dirty);
    				} else {
    					if_block131 = create_if_block_54(ctx);
    					if_block131.c();
    					if_block131.m(div16, t185);
    				}
    			} else if (if_block131) {
    				if_block131.d(1);
    				if_block131 = null;
    			}

    			if (/*PICoeb*/ ctx[46]) {
    				if (if_block132) {
    					if_block132.p(ctx, dirty);
    				} else {
    					if_block132 = create_if_block_53(ctx);
    					if_block132.c();
    					if_block132.m(div16, t186);
    				}
    			} else if (if_block132) {
    				if_block132.d(1);
    				if_block132 = null;
    			}

    			if (/*PICsortedplastic*/ ctx[34]) {
    				if (if_block133) {
    					if_block133.p(ctx, dirty);
    				} else {
    					if_block133 = create_if_block_52(ctx);
    					if_block133.c();
    					if_block133.m(div16, t187);
    				}
    			} else if (if_block133) {
    				if_block133.d(1);
    				if_block133 = null;
    			}

    			if (/*PICmusicposters*/ ctx[35]) {
    				if (if_block134) {
    					if_block134.p(ctx, dirty);
    				} else {
    					if_block134 = create_if_block_51(ctx);
    					if_block134.c();
    					if_block134.m(div16, t188);
    				}
    			} else if (if_block134) {
    				if_block134.d(1);
    				if_block134 = null;
    			}

    			if (/*PICtimatal*/ ctx[36]) {
    				if (if_block135) {
    					if_block135.p(ctx, dirty);
    				} else {
    					if_block135 = create_if_block_50(ctx);
    					if_block135.c();
    					if_block135.m(div16, t189);
    				}
    			} else if (if_block135) {
    				if_block135.d(1);
    				if_block135 = null;
    			}

    			if (/*PICtools*/ ctx[37]) {
    				if (if_block136) {
    					if_block136.p(ctx, dirty);
    				} else {
    					if_block136 = create_if_block_49(ctx);
    					if_block136.c();
    					if_block136.m(div16, t190);
    				}
    			} else if (if_block136) {
    				if_block136.d(1);
    				if_block136 = null;
    			}

    			if (/*PICfamiliarfaces*/ ctx[44]) {
    				if (if_block137) {
    					if_block137.p(ctx, dirty);
    				} else {
    					if_block137 = create_if_block_48(ctx);
    					if_block137.c();
    					if_block137.m(div16, t191);
    				}
    			} else if (if_block137) {
    				if_block137.d(1);
    				if_block137 = null;
    			}

    			if (/*PICmusicbook*/ ctx[39]) {
    				if (if_block138) {
    					if_block138.p(ctx, dirty);
    				} else {
    					if_block138 = create_if_block_47(ctx);
    					if_block138.c();
    					if_block138.m(div16, t192);
    				}
    			} else if (if_block138) {
    				if_block138.d(1);
    				if_block138 = null;
    			}

    			if (/*PICcorruptedspace*/ ctx[40]) {
    				if (if_block139) {
    					if_block139.p(ctx, dirty);
    				} else {
    					if_block139 = create_if_block_46(ctx);
    					if_block139.c();
    					if_block139.m(div16, t193);
    				}
    			} else if (if_block139) {
    				if_block139.d(1);
    				if_block139 = null;
    			}

    			if (/*PICsomalgors*/ ctx[52]) {
    				if (if_block140) {
    					if_block140.p(ctx, dirty);
    				} else {
    					if_block140 = create_if_block_45(ctx);
    					if_block140.c();
    					if_block140.m(div16, t194);
    				}
    			} else if (if_block140) {
    				if_block140.d(1);
    				if_block140 = null;
    			}

    			if (/*PIClitabok*/ ctx[42]) {
    				if (if_block141) {
    					if_block141.p(ctx, dirty);
    				} else {
    					if_block141 = create_if_block_44(ctx);
    					if_block141.c();
    					if_block141.m(div16, t195);
    				}
    			} else if (if_block141) {
    				if_block141.d(1);
    				if_block141 = null;
    			}

    			if (/*PICevublad*/ ctx[51]) {
    				if (if_block142) {
    					if_block142.p(ctx, dirty);
    				} else {
    					if_block142 = create_if_block_43(ctx);
    					if_block142.c();
    					if_block142.m(div16, t196);
    				}
    			} else if (if_block142) {
    				if_block142.d(1);
    				if_block142 = null;
    			}

    			if (/*PICplastica*/ ctx[43]) {
    				if (if_block143) {
    					if_block143.p(ctx, dirty);
    				} else {
    					if_block143 = create_if_block_42(ctx);
    					if_block143.c();
    					if_block143.m(div16, t197);
    				}
    			} else if (if_block143) {
    				if_block143.d(1);
    				if_block143 = null;
    			}

    			if (/*PICorgano*/ ctx[56]) {
    				if (if_block144) {
    					if_block144.p(ctx, dirty);
    				} else {
    					if_block144 = create_if_block_41(ctx);
    					if_block144.c();
    					if_block144.m(div16, t198);
    				}
    			} else if (if_block144) {
    				if_block144.d(1);
    				if_block144 = null;
    			}

    			if (/*PIClikamar*/ ctx[45]) {
    				if (if_block145) {
    					if_block145.p(ctx, dirty);
    				} else {
    					if_block145 = create_if_block_40(ctx);
    					if_block145.c();
    					if_block145.m(div16, t199);
    				}
    			} else if (if_block145) {
    				if_block145.d(1);
    				if_block145 = null;
    			}

    			if (/*other*/ ctx[78]) if_block146.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block97);
    			transition_in(if_block98);
    			transition_in(if_block99);
    			transition_in(if_block100);
    			transition_in(if_block101);
    			transition_in(if_block102);
    			transition_in(if_block103);
    			transition_in(if_block104);
    			transition_in(if_block105);
    			transition_in(if_block106);
    			transition_in(if_block107);
    			transition_in(if_block108);
    			transition_in(if_block109);
    			transition_in(if_block110);
    			transition_in(if_block111);
    			transition_in(if_block112);
    			transition_in(if_block113);
    			transition_in(if_block114);
    			transition_in(if_block115);
    			transition_in(if_block116);
    			transition_in(if_block117);
    			transition_in(if_block118);
    			transition_in(if_block119);
    			transition_in(if_block120);
    			transition_in(if_block121);
    			transition_in(if_block122);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block97);
    			transition_out(if_block98);
    			transition_out(if_block99);
    			transition_out(if_block100);
    			transition_out(if_block101);
    			transition_out(if_block102);
    			transition_out(if_block103);
    			transition_out(if_block104);
    			transition_out(if_block105);
    			transition_out(if_block106);
    			transition_out(if_block107);
    			transition_out(if_block108);
    			transition_out(if_block109);
    			transition_out(if_block110);
    			transition_out(if_block111);
    			transition_out(if_block112);
    			transition_out(if_block113);
    			transition_out(if_block114);
    			transition_out(if_block115);
    			transition_out(if_block116);
    			transition_out(if_block117);
    			transition_out(if_block118);
    			transition_out(if_block119);
    			transition_out(if_block120);
    			transition_out(if_block121);
    			transition_out(if_block122);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div11);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    			if (if_block5) if_block5.d();
    			if (if_block6) if_block6.d();
    			if (if_block7) if_block7.d();
    			if (if_block8) if_block8.d();
    			if (if_block9) if_block9.d();
    			if (if_block10) if_block10.d();
    			if (if_block11) if_block11.d();
    			if (if_block12) if_block12.d();
    			if (if_block13) if_block13.d();
    			if (if_block14) if_block14.d();
    			if (if_block15) if_block15.d();
    			if (if_block16) if_block16.d();
    			if (if_block17) if_block17.d();
    			if (if_block18) if_block18.d();
    			if (if_block19) if_block19.d();
    			if (if_block20) if_block20.d();
    			if (if_block21) if_block21.d();
    			if (if_block22) if_block22.d();
    			if (if_block23) if_block23.d();
    			if (if_block24) if_block24.d();
    			if (if_block25) if_block25.d();
    			if (if_block26) if_block26.d();
    			if (if_block27) if_block27.d();
    			if (if_block28) if_block28.d();
    			if (if_block29) if_block29.d();
    			if (if_block30) if_block30.d();
    			if (if_block31) if_block31.d();
    			if (if_block32) if_block32.d();
    			if (if_block33) if_block33.d();
    			if (if_block34) if_block34.d();
    			if (if_block35) if_block35.d();
    			if (if_block36) if_block36.d();
    			if (if_block37) if_block37.d();
    			if (if_block38) if_block38.d();
    			if (if_block39) if_block39.d();
    			if (if_block40) if_block40.d();
    			if (if_block41) if_block41.d();
    			if (if_block42) if_block42.d();
    			if (if_block43) if_block43.d();
    			if (if_block44) if_block44.d();
    			if (if_block45) if_block45.d();
    			if (if_block46) if_block46.d();
    			if (if_block47) if_block47.d();
    			if (if_block48) if_block48.d();
    			if (if_block49) if_block49.d();
    			if (if_block50) if_block50.d();
    			if (if_block51) if_block51.d();
    			if (if_block52) if_block52.d();
    			if (if_block53) if_block53.d();
    			if (if_block54) if_block54.d();
    			if (if_block55) if_block55.d();
    			if (if_block56) if_block56.d();
    			if (if_block57) if_block57.d();
    			if (if_block58) if_block58.d();
    			if (if_block59) if_block59.d();
    			if (if_block60) if_block60.d();
    			if (if_block61) if_block61.d();
    			if (if_block62) if_block62.d();
    			if (if_block63) if_block63.d();
    			if (if_block64) if_block64.d();
    			if (if_block65) if_block65.d();
    			if (if_block66) if_block66.d();
    			if (if_block67) if_block67.d();
    			if (if_block68) if_block68.d();
    			if (if_block69) if_block69.d();
    			if (if_block70) if_block70.d();
    			if (if_block71) if_block71.d();
    			if (if_block72) if_block72.d();
    			if (if_block73) if_block73.d();
    			if (if_block74) if_block74.d();
    			if (if_block75) if_block75.d();
    			if (if_block76) if_block76.d();
    			if (if_block77) if_block77.d();
    			if (if_block78) if_block78.d();
    			if (if_block79) if_block79.d();
    			if (if_block80) if_block80.d();
    			if (if_block81) if_block81.d();
    			if (if_block82) if_block82.d();
    			if (if_block83) if_block83.d();
    			if (if_block84) if_block84.d();
    			if (if_block85) if_block85.d();
    			if (if_block86) if_block86.d();
    			if (if_block87) if_block87.d();
    			if (if_block88) if_block88.d();
    			if (if_block89) if_block89.d();
    			if (if_block90) if_block90.d();
    			if (if_block91) if_block91.d();
    			if (if_block92) if_block92.d();
    			if (if_block93) if_block93.d();
    			if (if_block94) if_block94.d();
    			if (if_block95) if_block95.d();
    			if (if_block96) if_block96.d();
    			if (if_block97) if_block97.d();
    			if (if_block98) if_block98.d();
    			if (if_block99) if_block99.d();
    			if (if_block100) if_block100.d();
    			if (if_block101) if_block101.d();
    			if (if_block102) if_block102.d();
    			if (if_block103) if_block103.d();
    			if (if_block104) if_block104.d();
    			if (if_block105) if_block105.d();
    			if (if_block106) if_block106.d();
    			if (if_block107) if_block107.d();
    			if (if_block108) if_block108.d();
    			if (if_block109) if_block109.d();
    			if (if_block110) if_block110.d();
    			if (if_block111) if_block111.d();
    			if (if_block112) if_block112.d();
    			if (if_block113) if_block113.d();
    			if (if_block114) if_block114.d();
    			if (if_block115) if_block115.d();
    			if (if_block116) if_block116.d();
    			if (if_block117) if_block117.d();
    			if (if_block118) if_block118.d();
    			if (if_block119) if_block119.d();
    			if (if_block120) if_block120.d();
    			if (if_block121) if_block121.d();
    			if (if_block122) if_block122.d();
    			if (detaching) detach_dev(t133);
    			if (detaching) detach_dev(div13);
    			if (detaching) detach_dev(t155);
    			if (detaching) detach_dev(div17);
    			if (if_block123) if_block123.d();
    			if (if_block124) if_block124.d();
    			if (if_block125) if_block125.d();
    			if (if_block126) if_block126.d();
    			if (if_block127) if_block127.d();
    			if (if_block128) if_block128.d();
    			if (if_block129) if_block129.d();
    			if (if_block130) if_block130.d();
    			if (if_block131) if_block131.d();
    			if (if_block132) if_block132.d();
    			if (if_block133) if_block133.d();
    			if (if_block134) if_block134.d();
    			if (if_block135) if_block135.d();
    			if (if_block136) if_block136.d();
    			if (if_block137) if_block137.d();
    			if (if_block138) if_block138.d();
    			if (if_block139) if_block139.d();
    			if (if_block140) if_block140.d();
    			if (if_block141) if_block141.d();
    			if (if_block142) if_block142.d();
    			if (if_block143) if_block143.d();
    			if (if_block144) if_block144.d();
    			if (if_block145) if_block145.d();
    			if (if_block146) if_block146.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$q.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$q($$self, $$props, $$invalidate) {
    	let expand;
    	let frontscreen = true;
    	let other = true;
    	let CollapseIcon = false;
    	let ExpandIcon = true;
    	let onourowntime = false;
    	let green = false;
    	let viv = false;
    	let typoposters = false;
    	let secret = false;
    	let portfolioio = false;
    	let sortedplastic = false;
    	let musicposters = false;
    	let timatal = false;
    	let tools = false;
    	let trash = false;
    	let musicbook = false;
    	let corruptedspace = false;
    	let oilbuddies = false;
    	let litabok = false;
    	let plastica = false;
    	let familiarfaces = false;
    	let likamar = false;
    	let oeb = false;
    	let beauimg = false;
    	let bread = false;
    	let flora = false;
    	let breadmag = false;
    	let evublad = false;
    	let somalgors = false;
    	let organogram = false;

    	//let distanceBLines = 'calc((95vh - 1px) / 9 * 1)';
    	//let marginSides = 'calc(100vw / 16)';
    	//let Main = false;
    	//const toggleHide = () => {
    	//	scrollToFront = false;
    	//	Main = true;
    	//}
    	//const toggleother = () => { other = true;}
    	const toggleonourowntime = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = true);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglegreen = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = true);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleviv = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = true);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleportfolioio = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = true);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggletypoposters = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = true);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglesecret = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = true);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglesortedplastic = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = true);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglemusicposters = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = true);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggletimatal = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = true);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggletools = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = true);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleplastica = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = true);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglemusicbook = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = true);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglecorruptedspace = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = true);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleoilbuddies = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = true);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglefamiliarfaces = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = true);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglelitabok = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = true);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggletrash = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = true);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglelikamar = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = true);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleoeb = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = true);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglebeauimg = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = true);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglebread = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = true);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleflora = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = true);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglebreadmag = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = true);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleevublad = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = true);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const togglesomalgors = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = true);
    		$$invalidate(27, organogram = false);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleorganogram = () => {
    		$$invalidate(1, frontscreen = false);
    		$$invalidate(2, onourowntime = false);
    		$$invalidate(3, green = false);
    		$$invalidate(4, viv = false);
    		$$invalidate(7, portfolioio = false);
    		$$invalidate(5, typoposters = false);
    		$$invalidate(6, secret = false);
    		$$invalidate(8, sortedplastic = false);
    		$$invalidate(9, musicposters = false);
    		$$invalidate(10, timatal = false);
    		$$invalidate(11, tools = false);
    		$$invalidate(13, musicbook = false);
    		$$invalidate(14, corruptedspace = false);
    		$$invalidate(15, oilbuddies = false);
    		$$invalidate(17, plastica = false);
    		$$invalidate(18, familiarfaces = false);
    		$$invalidate(16, litabok = false);
    		$$invalidate(12, trash = false);
    		$$invalidate(19, likamar = false);
    		$$invalidate(20, oeb = false);
    		$$invalidate(21, beauimg = false);
    		$$invalidate(22, bread = false);
    		$$invalidate(23, flora = false);
    		$$invalidate(24, breadmag = false);
    		$$invalidate(25, evublad = false);
    		$$invalidate(26, somalgors = false);
    		$$invalidate(27, organogram = true);
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	let PIConourowntime = true;
    	let PICgreen = true;
    	let PICviv = true;
    	let PICtypoposters = true;
    	let PICsecret = true;
    	let PICportfolioio = true;
    	let PICsortedplastic = true;
    	let PICmusicposters = true;
    	let PICtimatal = true;
    	let PICtools = true;
    	let PICtrash = true;
    	let PICmusicbook = true;
    	let PICcorruptedspace = true;
    	let PICoilbuddies = true;
    	let PIClitabok = true;
    	let PICplastica = true;
    	let PICfamiliarfaces = true;
    	let PIClikamar = true;
    	let PICoeb = true;
    	let PICbeauimg = true;
    	let PICbread = true;
    	let PICflora = true;
    	let PICbreadmag = true;
    	let PICevublad = true;
    	let PICsomalgors = true;
    	let PICgjafakort = true;
    	let PICcalendarA = true;
    	let PICcalendarB = true;
    	let PICorgano = true;
    	let PICbeyond = true;
    	let PICtoomuch = true;
    	let PICproverb = true;
    	let PICpsdmynd = true;
    	let PICfloraA = true;
    	let PICcali = true;
    	let PICbaby = true;
    	let PICfimma = true;
    	let PICleturgif = true;
    	let PICpuppy = true;
    	let PICtypobook = true;
    	let PICbuyt = true;
    	let PICshu = true;
    	let PICrammi = true;
    	let PICspurn = true;
    	let PICmalverk = true;
    	let PICflottabok = true;
    	let PICljosmynd = true;
    	let PICegoposter = true;
    	let PICdrawing = true;
    	let PICbritney = true;
    	let PICbrandalism = true;
    	let PICegobook = true;
    	let PICmen = true;
    	let PICalltmitt = true;
    	let PICpsycho = true;
    	let PICgrad = true;

    	const toggleWEB = () => {
    		$$invalidate(36, PICtimatal = false);
    		$$invalidate(32, PICsecret = false);
    		$$invalidate(30, PICviv = false);
    		$$invalidate(31, PICtypoposters = false);
    		$$invalidate(35, PICmusicposters = false);
    		$$invalidate(44, PICfamiliarfaces = false);
    		$$invalidate(42, PIClitabok = false);
    		$$invalidate(38, PICtrash = false);
    		$$invalidate(45, PIClikamar = false);
    		$$invalidate(50, PICbreadmag = false);
    		$$invalidate(47, PICbeauimg = false);
    		$$invalidate(51, PICevublad = false);
    		$$invalidate(48, PICbread = false);
    		$$invalidate(28, PIConourowntime = true);
    		$$invalidate(29, PICgreen = true);
    		$$invalidate(33, PICportfolioio = true);
    		$$invalidate(34, PICsortedplastic = false);
    		$$invalidate(37, PICtools = false);
    		$$invalidate(39, PICmusicbook = false);
    		$$invalidate(40, PICcorruptedspace = false);
    		$$invalidate(41, PICoilbuddies = false);
    		$$invalidate(43, PICplastica = true);
    		$$invalidate(46, PICoeb = true);
    		$$invalidate(49, PICflora = true);
    		$$invalidate(52, PICsomalgors = true);
    		$$invalidate(53, PICgjafakort = false);
    		$$invalidate(54, PICcalendarA = false);
    		$$invalidate(55, PICcalendarB = false);
    		$$invalidate(56, PICorgano = true);
    		$$invalidate(57, PICbeyond = false);
    		$$invalidate(58, PICtoomuch = false);
    		$$invalidate(59, PICproverb = false);
    		$$invalidate(60, PICpsdmynd = false);
    		$$invalidate(61, PICfloraA = false);
    		$$invalidate(62, PICcali = false);
    		$$invalidate(63, PICbaby = false);
    		$$invalidate(64, PICfimma = false);
    		$$invalidate(65, PICleturgif = false);
    		$$invalidate(66, PICpuppy = false);
    		$$invalidate(67, PICtypobook = false);
    		$$invalidate(68, PICbuyt = true);
    		PICshu = false;
    		PICrammi = false;
    		PICspurn = false;
    		PICmalverk = false;
    		$$invalidate(69, PICflottabok = false);
    		PICljosmynd = false;
    		$$invalidate(70, PICegoposter = false);
    		$$invalidate(71, PICdrawing = false);
    		$$invalidate(72, PICbritney = true);
    		$$invalidate(73, PICbrandalism = false);
    		$$invalidate(74, PICegobook = false);
    		$$invalidate(75, PICmen = false);
    		$$invalidate(76, PICalltmitt = true);
    		$$invalidate(77, PICpsycho = false);
    		PICgrad = true;
    	};

    	const togglePRINT = () => {
    		$$invalidate(49, PICflora = false);
    		$$invalidate(28, PIConourowntime = false);
    		$$invalidate(29, PICgreen = true);
    		$$invalidate(30, PICviv = true);
    		$$invalidate(33, PICportfolioio = false);
    		$$invalidate(31, PICtypoposters = true);
    		$$invalidate(32, PICsecret = true);
    		$$invalidate(34, PICsortedplastic = true);
    		$$invalidate(35, PICmusicposters = true);
    		$$invalidate(36, PICtimatal = true);
    		$$invalidate(37, PICtools = true);
    		$$invalidate(39, PICmusicbook = true);
    		$$invalidate(40, PICcorruptedspace = true);
    		$$invalidate(41, PICoilbuddies = false);
    		$$invalidate(43, PICplastica = false);
    		$$invalidate(44, PICfamiliarfaces = true);
    		$$invalidate(42, PIClitabok = true);
    		$$invalidate(38, PICtrash = true);
    		$$invalidate(45, PIClikamar = false);
    		$$invalidate(46, PICoeb = false);
    		$$invalidate(47, PICbeauimg = true);
    		$$invalidate(48, PICbread = true);
    		$$invalidate(50, PICbreadmag = true);
    		$$invalidate(51, PICevublad = true);
    		$$invalidate(52, PICsomalgors = true);
    		$$invalidate(53, PICgjafakort = true);
    		$$invalidate(54, PICcalendarA = false);
    		$$invalidate(55, PICcalendarB = true);
    		$$invalidate(56, PICorgano = false);
    		$$invalidate(57, PICbeyond = true);
    		$$invalidate(58, PICtoomuch = true);
    		$$invalidate(59, PICproverb = true);
    		$$invalidate(60, PICpsdmynd = false);
    		$$invalidate(61, PICfloraA = false);
    		$$invalidate(62, PICcali = true);
    		$$invalidate(63, PICbaby = false);
    		$$invalidate(64, PICfimma = false);
    		$$invalidate(65, PICleturgif = false);
    		$$invalidate(66, PICpuppy = false);
    		$$invalidate(67, PICtypobook = true);
    		$$invalidate(68, PICbuyt = false);
    		PICshu = false;
    		PICrammi = true;
    		PICspurn = false;
    		PICmalverk = false;
    		$$invalidate(69, PICflottabok = true);
    		PICljosmynd = false;
    		$$invalidate(70, PICegoposter = true);
    		$$invalidate(71, PICdrawing = false);
    		$$invalidate(72, PICbritney = false);
    		$$invalidate(73, PICbrandalism = true);
    		$$invalidate(74, PICegobook = true);
    		$$invalidate(75, PICmen = false);
    		$$invalidate(76, PICalltmitt = false);
    		$$invalidate(77, PICpsycho = false);
    		PICgrad = false;
    	};

    	const toggleVIDEO = () => {
    		$$invalidate(28, PIConourowntime = false);
    		$$invalidate(29, PICgreen = true);
    		$$invalidate(30, PICviv = true);
    		$$invalidate(33, PICportfolioio = false);
    		$$invalidate(31, PICtypoposters = false);
    		$$invalidate(32, PICsecret = false);
    		$$invalidate(34, PICsortedplastic = false);
    		$$invalidate(35, PICmusicposters = false);
    		$$invalidate(36, PICtimatal = false);
    		$$invalidate(37, PICtools = false);
    		$$invalidate(39, PICmusicbook = true);
    		$$invalidate(40, PICcorruptedspace = true);
    		$$invalidate(41, PICoilbuddies = true);
    		$$invalidate(43, PICplastica = false);
    		$$invalidate(44, PICfamiliarfaces = true);
    		$$invalidate(42, PIClitabok = false);
    		$$invalidate(38, PICtrash = false);
    		$$invalidate(45, PIClikamar = false);
    		$$invalidate(46, PICoeb = false);
    		$$invalidate(47, PICbeauimg = false);
    		$$invalidate(48, PICbread = false);
    		$$invalidate(49, PICflora = true);
    		$$invalidate(50, PICbreadmag = false);
    		$$invalidate(51, PICevublad = false);
    		$$invalidate(52, PICsomalgors = false);
    		$$invalidate(53, PICgjafakort = false);
    		$$invalidate(54, PICcalendarA = false);
    		$$invalidate(55, PICcalendarB = false);
    		$$invalidate(56, PICorgano = false);
    		$$invalidate(57, PICbeyond = false);
    		$$invalidate(58, PICtoomuch = false);
    		$$invalidate(59, PICproverb = false);
    		$$invalidate(60, PICpsdmynd = false);
    		$$invalidate(61, PICfloraA = false);
    		$$invalidate(62, PICcali = false);
    		$$invalidate(63, PICbaby = false);
    		$$invalidate(64, PICfimma = false);
    		$$invalidate(65, PICleturgif = false);
    		$$invalidate(66, PICpuppy = false);
    		$$invalidate(67, PICtypobook = false);
    		$$invalidate(68, PICbuyt = false);
    		PICshu = false;
    		PICrammi = false;
    		PICspurn = false;
    		PICmalverk = false;
    		$$invalidate(69, PICflottabok = false);
    		PICljosmynd = false;
    		$$invalidate(70, PICegoposter = false);
    		$$invalidate(71, PICdrawing = false);
    		$$invalidate(72, PICbritney = false);
    		$$invalidate(73, PICbrandalism = false);
    		$$invalidate(74, PICegobook = false);
    		$$invalidate(75, PICmen = true);
    		$$invalidate(76, PICalltmitt = false);
    		$$invalidate(77, PICpsycho = true);
    		PICgrad = false;
    	};

    	const toggleOTHER = () => {
    		$$invalidate(49, PICflora = false);
    		$$invalidate(28, PIConourowntime = false);
    		$$invalidate(29, PICgreen = true);
    		$$invalidate(30, PICviv = false);
    		$$invalidate(33, PICportfolioio = false);
    		$$invalidate(31, PICtypoposters = false);
    		$$invalidate(32, PICsecret = false);
    		$$invalidate(34, PICsortedplastic = false);
    		$$invalidate(35, PICmusicposters = true);
    		$$invalidate(36, PICtimatal = false);
    		$$invalidate(37, PICtools = false);
    		$$invalidate(39, PICmusicbook = false);
    		$$invalidate(40, PICcorruptedspace = false);
    		$$invalidate(41, PICoilbuddies = false);
    		$$invalidate(43, PICplastica = false);
    		$$invalidate(44, PICfamiliarfaces = false);
    		$$invalidate(42, PIClitabok = true);
    		$$invalidate(38, PICtrash = true);
    		$$invalidate(45, PIClikamar = true);
    		$$invalidate(46, PICoeb = true);
    		$$invalidate(47, PICbeauimg = true);
    		$$invalidate(48, PICbread = true);
    		$$invalidate(50, PICbreadmag = false);
    		$$invalidate(51, PICevublad = false);
    		$$invalidate(52, PICsomalgors = false);
    		$$invalidate(53, PICgjafakort = false);
    		$$invalidate(54, PICcalendarA = true);
    		$$invalidate(55, PICcalendarB = false);
    		$$invalidate(56, PICorgano = false);
    		$$invalidate(57, PICbeyond = false);
    		$$invalidate(58, PICtoomuch = false);
    		$$invalidate(59, PICproverb = false);
    		$$invalidate(60, PICpsdmynd = true);
    		$$invalidate(61, PICfloraA = true);
    		$$invalidate(62, PICcali = true);
    		$$invalidate(63, PICbaby = true);
    		$$invalidate(64, PICfimma = true);
    		$$invalidate(65, PICleturgif = true);
    		$$invalidate(66, PICpuppy = true);
    		$$invalidate(67, PICtypobook = false);
    		$$invalidate(68, PICbuyt = false);
    		PICshu = true;
    		PICrammi = true;
    		PICspurn = true;
    		PICmalverk = true;
    		$$invalidate(69, PICflottabok = false);
    		PICljosmynd = true;
    		$$invalidate(70, PICegoposter = false);
    		$$invalidate(71, PICdrawing = true);
    		$$invalidate(72, PICbritney = false);
    		$$invalidate(73, PICbrandalism = false);
    		$$invalidate(74, PICegobook = false);
    		$$invalidate(75, PICmen = true);
    		$$invalidate(76, PICalltmitt = false);
    		$$invalidate(77, PICpsycho = true);
    		PICgrad = false;
    	};

    	const toggleALL = () => {
    		$$invalidate(28, PIConourowntime = true);
    		$$invalidate(29, PICgreen = true);
    		$$invalidate(30, PICviv = true);
    		$$invalidate(33, PICportfolioio = true);
    		$$invalidate(31, PICtypoposters = true);
    		$$invalidate(32, PICsecret = true);
    		$$invalidate(34, PICsortedplastic = true);
    		$$invalidate(35, PICmusicposters = true);
    		$$invalidate(36, PICtimatal = true);
    		$$invalidate(37, PICtools = true);
    		$$invalidate(39, PICmusicbook = true);
    		$$invalidate(40, PICcorruptedspace = true);
    		$$invalidate(41, PICoilbuddies = true);
    		$$invalidate(43, PICplastica = true);
    		$$invalidate(44, PICfamiliarfaces = true);
    		$$invalidate(42, PIClitabok = true);
    		$$invalidate(38, PICtrash = true);
    		$$invalidate(45, PIClikamar = true);
    		$$invalidate(46, PICoeb = true);
    		$$invalidate(47, PICbeauimg = true);
    		$$invalidate(48, PICbread = true);
    		$$invalidate(49, PICflora = true);
    		$$invalidate(50, PICbreadmag = true);
    		$$invalidate(51, PICevublad = true);
    		$$invalidate(52, PICsomalgors = true);
    		$$invalidate(53, PICgjafakort = true);
    		$$invalidate(54, PICcalendarA = true);
    		$$invalidate(55, PICcalendarB = true);
    		$$invalidate(56, PICorgano = true);
    		$$invalidate(57, PICbeyond = true);
    		$$invalidate(58, PICtoomuch = true);
    		$$invalidate(59, PICproverb = true);
    		$$invalidate(60, PICpsdmynd = true);
    		$$invalidate(61, PICfloraA = true);
    		$$invalidate(62, PICcali = true);
    		$$invalidate(63, PICbaby = true);
    		$$invalidate(64, PICfimma = true);
    		$$invalidate(65, PICleturgif = true);
    		$$invalidate(66, PICpuppy = true);
    		$$invalidate(67, PICtypobook = true);
    		$$invalidate(68, PICbuyt = true);
    		PICshu = true;
    		PICrammi = true;
    		PICspurn = true;
    		PICmalverk = true;
    		$$invalidate(69, PICflottabok = true);
    		PICljosmynd = true;
    		$$invalidate(70, PICegoposter = true);
    		$$invalidate(71, PICdrawing = true);
    		$$invalidate(72, PICbritney = true);
    		$$invalidate(73, PICbrandalism = true);
    		$$invalidate(74, PICegobook = true);
    		$$invalidate(75, PICmen = true);
    		$$invalidate(76, PICalltmitt = true);
    		$$invalidate(77, PICpsycho = true);
    		PICgrad = true;
    	};

    	const toggleCollapse = () => {
    		CollapseIcon = true;
    		ExpandIcon = false;
    	};

    	const toggleExpand = () => {
    		CollapseIcon = false;
    		ExpandIcon = true;
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	let { $$slots = {}, $$scope } = $$props;
    	validate_slots("App", $$slots, []);
    	const click_handler = () => $$invalidate(0, expand = !expand);
    	const click_handler_1 = () => $$invalidate(0, expand = !expand);
    	const click_handler_2 = () => $$invalidate(0, expand = !expand);
    	const click_handler_3 = () => $$invalidate(0, expand = !expand);
    	const click_handler_4 = () => $$invalidate(0, expand = !expand);
    	const click_handler_5 = () => $$invalidate(0, expand = !expand);
    	const click_handler_6 = () => $$invalidate(0, expand = !expand);
    	const click_handler_7 = () => $$invalidate(0, expand = !expand);
    	const click_handler_8 = () => $$invalidate(0, expand = !expand);
    	const click_handler_9 = () => $$invalidate(0, expand = !expand);
    	const click_handler_10 = () => $$invalidate(0, expand = !expand);
    	const click_handler_11 = () => $$invalidate(0, expand = !expand);
    	const click_handler_12 = () => $$invalidate(0, expand = !expand);
    	const click_handler_13 = () => $$invalidate(0, expand = !expand);
    	const click_handler_14 = () => $$invalidate(0, expand = !expand);
    	const click_handler_15 = () => $$invalidate(0, expand = !expand);
    	const click_handler_16 = () => $$invalidate(0, expand = !expand);
    	const click_handler_17 = () => $$invalidate(0, expand = !expand);
    	const click_handler_18 = () => $$invalidate(0, expand = !expand);
    	const click_handler_19 = () => $$invalidate(0, expand = !expand);
    	const click_handler_20 = () => $$invalidate(0, expand = !expand);
    	const click_handler_21 = () => $$invalidate(0, expand = !expand);
    	const click_handler_22 = () => $$invalidate(0, expand = !expand);
    	const click_handler_23 = () => $$invalidate(0, expand = !expand);

    	$$self.$capture_state = () => ({
    		Onourowntime,
    		Green,
    		Vivienne,
    		Portfolioio,
    		Typoposters,
    		Secret,
    		SortedPlastic: Sorted_plastic,
    		MusicPosters: Musicposters,
    		Timatal,
    		ToolsOfExpression,
    		Trash,
    		MusicBook,
    		Corrupted,
    		OilBuddies,
    		Litabok,
    		Plastica,
    		FamiliarFaces,
    		Likamar,
    		Oeb,
    		Beauimg,
    		Bread,
    		Flora,
    		Breadmag,
    		Evublad,
    		Somalgors,
    		Organogram,
    		expand,
    		frontscreen,
    		other,
    		CollapseIcon,
    		ExpandIcon,
    		onourowntime,
    		green,
    		viv,
    		typoposters,
    		secret,
    		portfolioio,
    		sortedplastic,
    		musicposters,
    		timatal,
    		tools,
    		trash,
    		musicbook,
    		corruptedspace,
    		oilbuddies,
    		litabok,
    		plastica,
    		familiarfaces,
    		likamar,
    		oeb,
    		beauimg,
    		bread,
    		flora,
    		breadmag,
    		evublad,
    		somalgors,
    		organogram,
    		toggleonourowntime,
    		togglegreen,
    		toggleviv,
    		toggleportfolioio,
    		toggletypoposters,
    		togglesecret,
    		togglesortedplastic,
    		togglemusicposters,
    		toggletimatal,
    		toggletools,
    		toggleplastica,
    		togglemusicbook,
    		togglecorruptedspace,
    		toggleoilbuddies,
    		togglefamiliarfaces,
    		togglelitabok,
    		toggletrash,
    		togglelikamar,
    		toggleoeb,
    		togglebeauimg,
    		togglebread,
    		toggleflora,
    		togglebreadmag,
    		toggleevublad,
    		togglesomalgors,
    		toggleorganogram,
    		PIConourowntime,
    		PICgreen,
    		PICviv,
    		PICtypoposters,
    		PICsecret,
    		PICportfolioio,
    		PICsortedplastic,
    		PICmusicposters,
    		PICtimatal,
    		PICtools,
    		PICtrash,
    		PICmusicbook,
    		PICcorruptedspace,
    		PICoilbuddies,
    		PIClitabok,
    		PICplastica,
    		PICfamiliarfaces,
    		PIClikamar,
    		PICoeb,
    		PICbeauimg,
    		PICbread,
    		PICflora,
    		PICbreadmag,
    		PICevublad,
    		PICsomalgors,
    		PICgjafakort,
    		PICcalendarA,
    		PICcalendarB,
    		PICorgano,
    		PICbeyond,
    		PICtoomuch,
    		PICproverb,
    		PICpsdmynd,
    		PICfloraA,
    		PICcali,
    		PICbaby,
    		PICfimma,
    		PICleturgif,
    		PICpuppy,
    		PICtypobook,
    		PICbuyt,
    		PICshu,
    		PICrammi,
    		PICspurn,
    		PICmalverk,
    		PICflottabok,
    		PICljosmynd,
    		PICegoposter,
    		PICdrawing,
    		PICbritney,
    		PICbrandalism,
    		PICegobook,
    		PICmen,
    		PICalltmitt,
    		PICpsycho,
    		PICgrad,
    		toggleWEB,
    		togglePRINT,
    		toggleVIDEO,
    		toggleOTHER,
    		toggleALL,
    		toggleCollapse,
    		toggleExpand
    	});

    	$$self.$inject_state = $$props => {
    		if ("expand" in $$props) $$invalidate(0, expand = $$props.expand);
    		if ("frontscreen" in $$props) $$invalidate(1, frontscreen = $$props.frontscreen);
    		if ("other" in $$props) $$invalidate(78, other = $$props.other);
    		if ("CollapseIcon" in $$props) CollapseIcon = $$props.CollapseIcon;
    		if ("ExpandIcon" in $$props) ExpandIcon = $$props.ExpandIcon;
    		if ("onourowntime" in $$props) $$invalidate(2, onourowntime = $$props.onourowntime);
    		if ("green" in $$props) $$invalidate(3, green = $$props.green);
    		if ("viv" in $$props) $$invalidate(4, viv = $$props.viv);
    		if ("typoposters" in $$props) $$invalidate(5, typoposters = $$props.typoposters);
    		if ("secret" in $$props) $$invalidate(6, secret = $$props.secret);
    		if ("portfolioio" in $$props) $$invalidate(7, portfolioio = $$props.portfolioio);
    		if ("sortedplastic" in $$props) $$invalidate(8, sortedplastic = $$props.sortedplastic);
    		if ("musicposters" in $$props) $$invalidate(9, musicposters = $$props.musicposters);
    		if ("timatal" in $$props) $$invalidate(10, timatal = $$props.timatal);
    		if ("tools" in $$props) $$invalidate(11, tools = $$props.tools);
    		if ("trash" in $$props) $$invalidate(12, trash = $$props.trash);
    		if ("musicbook" in $$props) $$invalidate(13, musicbook = $$props.musicbook);
    		if ("corruptedspace" in $$props) $$invalidate(14, corruptedspace = $$props.corruptedspace);
    		if ("oilbuddies" in $$props) $$invalidate(15, oilbuddies = $$props.oilbuddies);
    		if ("litabok" in $$props) $$invalidate(16, litabok = $$props.litabok);
    		if ("plastica" in $$props) $$invalidate(17, plastica = $$props.plastica);
    		if ("familiarfaces" in $$props) $$invalidate(18, familiarfaces = $$props.familiarfaces);
    		if ("likamar" in $$props) $$invalidate(19, likamar = $$props.likamar);
    		if ("oeb" in $$props) $$invalidate(20, oeb = $$props.oeb);
    		if ("beauimg" in $$props) $$invalidate(21, beauimg = $$props.beauimg);
    		if ("bread" in $$props) $$invalidate(22, bread = $$props.bread);
    		if ("flora" in $$props) $$invalidate(23, flora = $$props.flora);
    		if ("breadmag" in $$props) $$invalidate(24, breadmag = $$props.breadmag);
    		if ("evublad" in $$props) $$invalidate(25, evublad = $$props.evublad);
    		if ("somalgors" in $$props) $$invalidate(26, somalgors = $$props.somalgors);
    		if ("organogram" in $$props) $$invalidate(27, organogram = $$props.organogram);
    		if ("PIConourowntime" in $$props) $$invalidate(28, PIConourowntime = $$props.PIConourowntime);
    		if ("PICgreen" in $$props) $$invalidate(29, PICgreen = $$props.PICgreen);
    		if ("PICviv" in $$props) $$invalidate(30, PICviv = $$props.PICviv);
    		if ("PICtypoposters" in $$props) $$invalidate(31, PICtypoposters = $$props.PICtypoposters);
    		if ("PICsecret" in $$props) $$invalidate(32, PICsecret = $$props.PICsecret);
    		if ("PICportfolioio" in $$props) $$invalidate(33, PICportfolioio = $$props.PICportfolioio);
    		if ("PICsortedplastic" in $$props) $$invalidate(34, PICsortedplastic = $$props.PICsortedplastic);
    		if ("PICmusicposters" in $$props) $$invalidate(35, PICmusicposters = $$props.PICmusicposters);
    		if ("PICtimatal" in $$props) $$invalidate(36, PICtimatal = $$props.PICtimatal);
    		if ("PICtools" in $$props) $$invalidate(37, PICtools = $$props.PICtools);
    		if ("PICtrash" in $$props) $$invalidate(38, PICtrash = $$props.PICtrash);
    		if ("PICmusicbook" in $$props) $$invalidate(39, PICmusicbook = $$props.PICmusicbook);
    		if ("PICcorruptedspace" in $$props) $$invalidate(40, PICcorruptedspace = $$props.PICcorruptedspace);
    		if ("PICoilbuddies" in $$props) $$invalidate(41, PICoilbuddies = $$props.PICoilbuddies);
    		if ("PIClitabok" in $$props) $$invalidate(42, PIClitabok = $$props.PIClitabok);
    		if ("PICplastica" in $$props) $$invalidate(43, PICplastica = $$props.PICplastica);
    		if ("PICfamiliarfaces" in $$props) $$invalidate(44, PICfamiliarfaces = $$props.PICfamiliarfaces);
    		if ("PIClikamar" in $$props) $$invalidate(45, PIClikamar = $$props.PIClikamar);
    		if ("PICoeb" in $$props) $$invalidate(46, PICoeb = $$props.PICoeb);
    		if ("PICbeauimg" in $$props) $$invalidate(47, PICbeauimg = $$props.PICbeauimg);
    		if ("PICbread" in $$props) $$invalidate(48, PICbread = $$props.PICbread);
    		if ("PICflora" in $$props) $$invalidate(49, PICflora = $$props.PICflora);
    		if ("PICbreadmag" in $$props) $$invalidate(50, PICbreadmag = $$props.PICbreadmag);
    		if ("PICevublad" in $$props) $$invalidate(51, PICevublad = $$props.PICevublad);
    		if ("PICsomalgors" in $$props) $$invalidate(52, PICsomalgors = $$props.PICsomalgors);
    		if ("PICgjafakort" in $$props) $$invalidate(53, PICgjafakort = $$props.PICgjafakort);
    		if ("PICcalendarA" in $$props) $$invalidate(54, PICcalendarA = $$props.PICcalendarA);
    		if ("PICcalendarB" in $$props) $$invalidate(55, PICcalendarB = $$props.PICcalendarB);
    		if ("PICorgano" in $$props) $$invalidate(56, PICorgano = $$props.PICorgano);
    		if ("PICbeyond" in $$props) $$invalidate(57, PICbeyond = $$props.PICbeyond);
    		if ("PICtoomuch" in $$props) $$invalidate(58, PICtoomuch = $$props.PICtoomuch);
    		if ("PICproverb" in $$props) $$invalidate(59, PICproverb = $$props.PICproverb);
    		if ("PICpsdmynd" in $$props) $$invalidate(60, PICpsdmynd = $$props.PICpsdmynd);
    		if ("PICfloraA" in $$props) $$invalidate(61, PICfloraA = $$props.PICfloraA);
    		if ("PICcali" in $$props) $$invalidate(62, PICcali = $$props.PICcali);
    		if ("PICbaby" in $$props) $$invalidate(63, PICbaby = $$props.PICbaby);
    		if ("PICfimma" in $$props) $$invalidate(64, PICfimma = $$props.PICfimma);
    		if ("PICleturgif" in $$props) $$invalidate(65, PICleturgif = $$props.PICleturgif);
    		if ("PICpuppy" in $$props) $$invalidate(66, PICpuppy = $$props.PICpuppy);
    		if ("PICtypobook" in $$props) $$invalidate(67, PICtypobook = $$props.PICtypobook);
    		if ("PICbuyt" in $$props) $$invalidate(68, PICbuyt = $$props.PICbuyt);
    		if ("PICshu" in $$props) PICshu = $$props.PICshu;
    		if ("PICrammi" in $$props) PICrammi = $$props.PICrammi;
    		if ("PICspurn" in $$props) PICspurn = $$props.PICspurn;
    		if ("PICmalverk" in $$props) PICmalverk = $$props.PICmalverk;
    		if ("PICflottabok" in $$props) $$invalidate(69, PICflottabok = $$props.PICflottabok);
    		if ("PICljosmynd" in $$props) PICljosmynd = $$props.PICljosmynd;
    		if ("PICegoposter" in $$props) $$invalidate(70, PICegoposter = $$props.PICegoposter);
    		if ("PICdrawing" in $$props) $$invalidate(71, PICdrawing = $$props.PICdrawing);
    		if ("PICbritney" in $$props) $$invalidate(72, PICbritney = $$props.PICbritney);
    		if ("PICbrandalism" in $$props) $$invalidate(73, PICbrandalism = $$props.PICbrandalism);
    		if ("PICegobook" in $$props) $$invalidate(74, PICegobook = $$props.PICegobook);
    		if ("PICmen" in $$props) $$invalidate(75, PICmen = $$props.PICmen);
    		if ("PICalltmitt" in $$props) $$invalidate(76, PICalltmitt = $$props.PICalltmitt);
    		if ("PICpsycho" in $$props) $$invalidate(77, PICpsycho = $$props.PICpsycho);
    		if ("PICgrad" in $$props) PICgrad = $$props.PICgrad;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		expand,
    		frontscreen,
    		onourowntime,
    		green,
    		viv,
    		typoposters,
    		secret,
    		portfolioio,
    		sortedplastic,
    		musicposters,
    		timatal,
    		tools,
    		trash,
    		musicbook,
    		corruptedspace,
    		oilbuddies,
    		litabok,
    		plastica,
    		familiarfaces,
    		likamar,
    		oeb,
    		beauimg,
    		bread,
    		flora,
    		breadmag,
    		evublad,
    		somalgors,
    		organogram,
    		PIConourowntime,
    		PICgreen,
    		PICviv,
    		PICtypoposters,
    		PICsecret,
    		PICportfolioio,
    		PICsortedplastic,
    		PICmusicposters,
    		PICtimatal,
    		PICtools,
    		PICtrash,
    		PICmusicbook,
    		PICcorruptedspace,
    		PICoilbuddies,
    		PIClitabok,
    		PICplastica,
    		PICfamiliarfaces,
    		PIClikamar,
    		PICoeb,
    		PICbeauimg,
    		PICbread,
    		PICflora,
    		PICbreadmag,
    		PICevublad,
    		PICsomalgors,
    		PICgjafakort,
    		PICcalendarA,
    		PICcalendarB,
    		PICorgano,
    		PICbeyond,
    		PICtoomuch,
    		PICproverb,
    		PICpsdmynd,
    		PICfloraA,
    		PICcali,
    		PICbaby,
    		PICfimma,
    		PICleturgif,
    		PICpuppy,
    		PICtypobook,
    		PICbuyt,
    		PICflottabok,
    		PICegoposter,
    		PICdrawing,
    		PICbritney,
    		PICbrandalism,
    		PICegobook,
    		PICmen,
    		PICalltmitt,
    		PICpsycho,
    		other,
    		toggleonourowntime,
    		togglegreen,
    		toggleviv,
    		toggleportfolioio,
    		toggletypoposters,
    		togglesortedplastic,
    		togglemusicposters,
    		toggletimatal,
    		toggletools,
    		toggleplastica,
    		togglemusicbook,
    		togglecorruptedspace,
    		togglefamiliarfaces,
    		togglelitabok,
    		togglelikamar,
    		toggleoeb,
    		togglebeauimg,
    		togglebread,
    		toggleflora,
    		togglebreadmag,
    		toggleevublad,
    		togglesomalgors,
    		toggleorganogram,
    		toggleWEB,
    		togglePRINT,
    		toggleVIDEO,
    		toggleOTHER,
    		toggleALL,
    		toggleCollapse,
    		CollapseIcon,
    		ExpandIcon,
    		PICshu,
    		PICrammi,
    		PICspurn,
    		PICmalverk,
    		PICljosmynd,
    		PICgrad,
    		togglesecret,
    		toggleoilbuddies,
    		toggletrash,
    		toggleExpand,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13,
    		click_handler_14,
    		click_handler_15,
    		click_handler_16,
    		click_handler_17,
    		click_handler_18,
    		click_handler_19,
    		click_handler_20,
    		click_handler_21,
    		click_handler_22,
    		click_handler_23
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$q, create_fragment$q, safe_not_equal, {}, [-1, -1, -1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$q.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
