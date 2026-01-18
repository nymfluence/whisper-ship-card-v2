

{{/*
  WHISPER – Ship (API image card)
  Command: !ship [@user1] [@user2]
*/}}

{{$base := "https://whisper-ship-card-v2.vercel.app/api/ship"}}

{{/* Random score 1–100 */}}
{{$score := randInt 1 101}}

{{/* Default pair */}}
{{$uA := .User}}  {{/* left */}}
{{$uB := .User}}  {{/* right */}}

{{/* If 2 args: ship arg0 + arg1 */}}
{{if ge (len .CmdArgs) 2}}
  {{$a0 := index .CmdArgs 0}}
  {{$a1 := index .CmdArgs 1}}
  {{with (getMember $a0)}} {{$uA = .User}} {{end}}
  {{with (getMember $a1)}} {{$uB = .User}} {{end}}

{{/* Else if 1 arg: ship YOU + arg0 */}}
{{else if eq (len .CmdArgs) 1}}
  {{$a0 := index .CmdArgs 0}}
  {{with (getMember $a0)}}
    {{$uA = $.User}}
    {{$uB = .User}}
  {{end}}
{{end}}

{{/* Avatar URLs (PNG, 256) + URL-encode */}}
{{$u1 := urlquery ($uA.AvatarURL "256")}}
{{$u2 := urlquery ($uB.AvatarURL "256")}}

{{/* Cache buster */}}
{{$t := currentTime.UnixNano}}

{{/* Final image URL */}}
{{$img := printf "%s?score=%d&u1=%s&u2=%s&t=%d" $base $score $u1 $u2 $t}}

{{/* Optional flavour */}}
{{$line := ""}}
{{if eq $score 100}}
  {{$line = "Absolute soulmates. Or absolute chaos. Same thing."}}
{{else if eq $score 69}}
  {{$line = "Nice."}}
{{else if ge $score 80}}
  {{$line = "Okay… that’s actually spicy."}}
{{else if ge $score 50}}
  {{$line = "This could work… with effort."}}
{{else}}
  {{$line = "Respectfully… no."}}
{{end}}

{{$authorIcon := ""}}
{{if .Guild.Icon}}
  {{$authorIcon = .Guild.IconURL "256"}}
{{end}}

{{sendMessage nil (cembed
  "author" (sdict "name" "W H I S P E R Ship" "icon_url" $authorIcon)
  "color" 0x761C20
  "description" (printf "%s\n\n%s ❤ %s" $line $uA.Mention $uB.Mention)
  "image" (sdict "url" $img)
  "footer" (sdict "text" (printf "Rolled: %d%%" $score))
)}}
