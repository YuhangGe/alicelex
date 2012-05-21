(function(A, C, N, D, T, U) {
	/**
	 * 将lex规则转换成dfa
	 * 注意标志符目前暂时不支持数字。即可以
	 * NUM \d+ 但不能  NUM_1 \d+
	 * 同时，如果由已经定义的规则再组合规则，则需要用{}引用。
	 * 比如
	 * FLOAT {NUM}\.{NUM}
	 * 但是如果是 FLOAT NUM\.NUM则是把NUM当作直接的字符串。
	 */

	C.Lexer = {
		src : null,
		idx : 0,
		cur_t : null,
		define : {},
		define_used : {},
		rule : {
			"DEFAULT" : []
		},
		routine : {'construct': '','start': '', 'finish' : '', 'error':''}
	};
	U.extend(C.Lexer, {
		_define : function() {
			var in_option = true;
			while(in_option){
				var option = this.cur_t.toLowerCase();
				switch(option){
					case '$caseignore':
						this.read_word();
						D.Dfa2Src.case_ignore = this.cur_t.toLowerCase()==="true"?true:false;
						if(this.cur_t==='true'){
							$.log("option - case ignore: true");
						}
						this.read_word();
						break;
					case '$lexname':
						this.read_word();
						D.Dfa2Src.lex_name = this.cur_t;
						$.log("option - lex name: "+this.cur_t);
						this.read_word();
						break;
					case '$template':
					    this.read_word();
					    D.Dfa2Src.template = this.cur_t;
					    $.log("option - template name: "+this.cur_t);
					    this.read_word();
					default:
						in_option= false;
						break;
				}
			}

			while(this.cur_t !== '$$' && this.cur_t != null) {
				//$.dprint(this.cur_t);
				this._d_line();
				//$.aprint(Alice.CharTable.char_table);
				//$.aprint(Alice.CharTable.eq_class);
				this.read_word();
			}
			this.read_word();
		},
		_d_line : function() {
			var lbl = this.cur_t;
			var exp = this.read_word();

			var r = N.Str2Nfa.parse(exp);
			r.finish.isAccept = false;
			//$.dprint(lbl);
			this.define[lbl] = r;
		},
		_rule : function() {
			while(this.cur_t !== '$$' && this.cur_t != null) {

				this._r_line();
				this.read_word();

			}
			this.read_word();
			this._routine();
		},
		_r_line : function() {
			var lbl = this.cur_t, state = "DEFAULT";
			if(this.cur_t === "<") {
				state = this.read_word();
				if(state === "Daisy") {
					throw "不能使用Daisy作为状态标识。"
				}
				//$.dprint(state);
				this.idx--;

				if(this.read_word() !== ">")
					throw "error! state must be closed by '>'."
				lbl = this.read_word();
			}
			//$.dprint("state: %s, lbl: %s",state,lbl);
			var expNfa = this.define[lbl];
			if(expNfa == null)
				throw "没有定义的标识@_r_line 0:" + lbl;
			if(this.define_used[lbl] === true) {
				/**
				 * 如果在define块定义的标识已经被某个状态集使用过，则必须使用它的拷贝来生成一个rule
				 */
				expNfa = expNfa.copy();
			} else {
				this.define_used[lbl] = true;
			}
			var func_str = "";
			var c = this.read_ch();
			var until = '\n';
			while(c !== null && this.isSpace(c) && c !== until)
			c = this.read_ch();
			if(c === '{') {
				until = '}';
				c = this.read_ch();
			}
			while(c !== null && c !== until) {
				func_str += c;
				c = this.read_ch();
			}
			//this.read_ch();

			expNfa.finish.isAccept = true;
			expNfa.finish.action = new C.Action(func_str);

			if(this.rule[state] == null) {
				this.rule[state] = [];
			}
			this.rule[state].push(expNfa);
		},
		_routine : function() {
			while(this.cur_t!==null){
				this._routine_line(this.cur_t);
				this.read_word();
			}
			
		},
		_routine_line : function(name){
			name = name.toLowerCase();
			var func_str = "";
			var c = this.read_ch();
			var until = '\n';
			while(c !== null && this.isSpace(c) && c !== until)
			c = this.read_ch();
			if(c === '{') {
				until = '}';
				c = this.read_ch();
			}
			while(c !== null && c !== until) {
				func_str += c;
				c = this.read_ch();
			}
			if(['$construct','$start','$finish','$error'].indexOf(name)<0){
				console.log("warning: unknow global function "+name+", ignored.");
				return;
			}else{
				$.log(name);
				$.log(func_str);
			}
			this.routine[name.substring(1,name.length)] = func_str;
		},
		read_ch : function() {
			if(this.idx === this.len) {
				return null;
			} else {
				return this.src[this.idx++];
			}
		},
		back_ch : function() {
			if(this.idx > 0)
				this.idx--;
		},
		read_word : function() {
			var c = this.read_ch();
			while(c !== null && this.isSpace(c))
			c = this.read_ch();
			if(c === "<" || c === ">")
				return this.cur_t = c;

			var w = "";
			var quote = null;
			if(c === '[')
				quote = ']';
			while(c !== null) {
				if(quote === null && (this.isSpace(c) || c === ">"))
					break;
				w += c;

				if(c === "\\") {
					c = this.read_ch();
					if(c !== null)
						w += c
				} else if(c === '\"' || c === '\'') {
					if(quote === c)
						quote = null;
					else if(quote === null)
						quote = c;
				} else if(c === '[' && quote === null) {
					quote = ']';
				} else if(c === ']' && quote !== null) {
					quote = null;
				}
				c = this.read_ch();
			}
			//$.dprint("w:"+w);
			if(w.length === 0)
				this.cur_t = null;
			else
				this.cur_t = w;
			return this.cur_t;
		},
		parse : function(source) {
			//init
			this.src = source;
			this.idx = 0;
			this.len = source.length;
			//begin parse
			this.read_word();

			this._define();

			this._rule();
			this._routine();

			var dfa_arr = [], default_dfa = null, states = {};
			//$.dprint(lexNFA);
			for(var s in this.rule) {
				var rs = this.rule[s];
				var lexNFA = new N.NFA();
				var lexStart = new N.NFAState();
				lexNFA.start = lexStart;
				lexNFA.addState(lexStart);
				for(var i = 0; i < rs.length; i++) {
					var nfaExp = rs[i];
					lexStart.addMove(C.Input.e, nfaExp.start);
					lexNFA.addState(nfaExp.states);
				}
				//$.dprint(lexNFA);
				var dfa = N.Nfa2Dfa.parse(lexNFA);
				//$.dprint(dfa);
				var m_dfa = D.DfaMinimize.parse(dfa);
				//$.dprint(m_dfa);
				m_dfa.state_name = s;
				dfa_arr.push(m_dfa);
				if(s === "DEFAULT")
					default_dfa = m_dfa;

			}
			//$.dprint(dfa_arr);

			var dfa_obj = {
				dfa_array : dfa_arr,
				default_dfa : default_dfa,
			}

			T.Dfa2Table.parse(dfa_obj);
			/*$.aprint(m_dfa.table_base);
			 $.dprint(Alice.Help.array_to_str(m_dfa.table_base));
			 $.aprint(m_dfa.table_default);
			 $.dprint(Alice.Help.array_to_str(m_dfa.table_default));
			 $.aprint(m_dfa.table_check);
			 $.dprint(Alice.Help.array_to_str(m_dfa.table_check));
			 $.aprint(m_dfa.table_next);
			 $.dprint(Alice.Help.array_to_str(m_dfa.table_next));
			 $.aprint(m_dfa.table_action);
			 $.dprint(Alice.Help.array_to_str(m_dfa.table_action));
			 $.dprint(Alice.Help.array_to_str(Alice.CharTable.char_table));
			 */
			return {
				dfa_obj : dfa_obj,
				routine : this.routine
			}

		},
		isSpace : function(chr) {
			return chr === ' ' || chr === '\n' || chr === '\t' || chr === '\r';
		}
	});

})(Alice, Alice.Core, Alice.Nfa, Alice.Dfa, Alice.Table, Alice.Utility);

