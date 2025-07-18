; shamelessly copied from https://github.com/erasin/helix-config

; leptos
((macro_invocation
   macro:
     [
       (scoped_identifier
         name: (_) @_macro_name)
       (identifier) @_macro_name
     ]
   (token_tree) @injection.content)
 (#eq? @_macro_name "view")
 (#set! injection.language "rstml")
 (#set! injection.include-children))

; dioxus
((macro_invocation
   macro:
     [
       (scoped_identifier
         name: (_) @_macro_name)
       (identifier) @_macro_name
     ]
   (token_tree) @injection.content)
 (#eq? @_macro_name "rsx")
 (#set! injection.language "rust-format-args")
 (#set! injection.include-children))

; lua
((macro_invocation
   macro:
     [
       (scoped_identifier
         name: (_) @_macro_name)
       (identifier) @_macro_name
     ]
   (token_tree) @injection.content)
 (#eq? @_macro_name "chunk")
 (#set! injection.language "luau")
 (#set! injection.include-children))

; tokio select!
((macro_invocation
   macro:
     [
       (scoped_identifier
         name: (_) @_macro_name)
       (identifier) @_macro_name
     ]
   (token_tree) @injection.content)
 (#eq? @_macro_name "select")
 (#set! injection.language "rust")
 (#set! injection.include-children))
