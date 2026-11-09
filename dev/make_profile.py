#!/usr/bin/env python3
"""Build a throwaway Betterbird profile with a Local Folders inbox of sample mail.
usage: make_profile.py <profile_dir> [light|dark]"""
import sys, os, shutil, email.utils, datetime
prof = sys.argv[1]
scheme = sys.argv[2] if len(sys.argv) > 2 else "dark"
shutil.rmtree(prof, ignore_errors=True)
mail = os.path.join(prof, "Mail", "Local Folders")
os.makedirs(mail)

import base64
people=[("Anna Kowalska","anna@example.com"),("GitHub","noreply@github.com"),("Piotr Nowak","piotr@firma.pl"),
 ("Stripe","receipts@stripe.com"),("Marta Zielinska","marta@example.org"),("Hetzner","billing@hetzner.com"),
 ("Tomasz Lewandowski-Wisniewski","tomek@dlugadomena-firmy.example.pl"),("Newsletter Weekly","news@weekly.io")]
subjects=["Faktura FV/2026/11/042","[repo] PR #214: Fix pagination","Spotkanie w czwartek","Your receipt from Stripe",
 "Re: Oferta wspolpracy","Rechnung November","Projekt: harmonogram i budzet na kolejny kwartal 2027 wraz z uwagami zespolu","This week in Rust","Zaproszenie na webinar",
 "Re: Re: Umowa najmu","Security alert for your account","Zdjecia z wyjazdu","Podsumowanie kwartalu","Nowe funkcje w wersji 5.2",
 "Przypomnienie: platnosc","Pytanie o integracje API"]
base=datetime.datetime(2026,11,9,9,30)
def hdr(i,n,a,subj,status="0000",extra="",ct="text/plain; charset=UTF-8",refs="",keys=""):
    d=email.utils.format_datetime((base-datetime.timedelta(hours=i*7)).replace(tzinfo=datetime.timezone.utc))
    h=f"From - {d}\nX-Mozilla-Status: {status}\nX-Mozilla-Status2: 00000000\n"
    if keys: h+=f"X-Mozilla-Keys: {keys}\n"
    h+=f"From: {n} <{a}>\nTo: me@example.com\nSubject: {subj}\nDate: {d}\nMessage-ID: <m{i}-{abs(hash(subj))%9999}@example.com>\nMIME-Version: 1.0\n"
    if refs: h+=f"References: {refs}\nIn-Reply-To: {refs}\n"
    return h+extra+f"Content-Type: {ct}\n\n"
def plain(i,n):
    return f"Czesc,\n\nto jest przykladowa wiadomosc numer {i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n> cytat z poprzedniej wiadomosci\n> druga linia\n\nPozdrawiam,\n{n}\n\n"
msgs=[]
for i,sj in enumerate(subjects):
    n,a=people[i%len(people)]
    read=i in (4,5,8,9,11,12,13,14,15)
    st=("0001" if read else "0000")
    keys=""
    if i==1: st="0005" if read else "0004"   # flagged
    if i==2: keys="$label4"
    if i==6: keys="$label1 $label2"
    if i==0:   # attachment
        b="XYZ"; att=base64.b64encode(b"hello attachment\n"*50).decode()
        m=hdr(i,n,a,sj,st,ct='multipart/mixed; boundary="B1"')+f'--B1\nContent-Type: text/plain; charset=UTF-8\n\n{plain(i,n)}\n--B1\nContent-Type: application/pdf; name="faktura.pdf"\nContent-Disposition: attachment; filename="faktura.pdf"\nContent-Transfer-Encoding: base64\n\n{att}\n--B1--\n'
    elif i==3:  # html
        m=hdr(i,n,a,sj,st,ct="text/html; charset=UTF-8")+'<html><body style="font-family:sans-serif"><h2>Dziekujemy za platnosc</h2><p>Kwota: <b>49,00 PLN</b></p><table border="1" cellpadding="6"><tr><td>Plan</td><td>Pro</td></tr></table><p><a href="https://example.com">Zobacz fakture</a></p></body></html>\n'
    elif i in (9,):  # thread child
        m=hdr(i,n,a,sj,st,refs="<m10-1@example.com>")+plain(i,n)
    else:
        ex='List-Unsubscribe: <mailto:unsub@weekly.io?subject=unsubscribe>, <https://weekly.io/u?id=1>\nList-Unsubscribe-Post: List-Unsubscribe=One-Click\n' if i==7 else ''
        m=hdr(i,n,a,sj,st,extra=ex,keys=keys)+plain(i,n)
    msgs.append(m)
# a small thread
for k,(who,subj) in enumerate([(0,"Plan wdrozenia"),(2,"Re: Plan wdrozenia"),(4,"Re: Plan wdrozenia")]):
    n,a=people[who]
    msgs.append(hdr(20+k,n,a,subj,"0000" if k==2 else "0001",refs="" if k==0 else "<thr0@example.com>").replace(f"Message-ID: <m{20+k}-",f"Message-ID: <{'thr'+str(k)}@x-")+plain(20+k,n))
open(os.path.join(mail,"Inbox"),"w").write("".join(msgs))
for f in ("Trash","Sent","Drafts","Unsent Messages"): open(os.path.join(mail,f),"w").write("")
# second account (POP3, offline) with nested folders
m2=os.path.join(prof,"Mail","pop.firma.pl"); os.makedirs(os.path.join(m2,"Inbox.sbd","Klienci.sbd"))
for f in ("Inbox","Sent","Trash","Drafts","Inbox.sbd/Klienci","Inbox.sbd/Faktury","Inbox.sbd/Klienci.sbd/Acme Sp. z o.o."):
    open(os.path.join(m2,f),"w").write("")
open(os.path.join(m2,"Inbox"),"w").write("".join(msgs[:6]))

prefs = {
 "mail.accountmanager.accounts": "account1,account2",
 "mail.accountmanager.defaultaccount": "account1",
 "mail.accountmanager.localfoldersserver": "server1",
 "mail.account.account1.server": "server1",
 "mail.account.account1.identities": "id1",
 "mail.identity.id1.useremail": "me@example.com",
 "mail.identity.id1.fullName": "Me",
 "mail.identity.id1.valid": True,
 "mail.identity.id1.smtpServer": "smtp1",
 "mail.smtpservers": "smtp1",
 "mail.smtpserver.smtp1.hostname": "localhost",
 "mail.smtpserver.smtp1.port": 25,
 "mail.server.server1.type": "none",
 "mail.server.server1.hostname": "Local Folders",
 "mail.server.server1.userName": "nobody",
 "mail.server.server1.name": "Local Folders",
 "mail.server.server1.directory": mail,
 "mail.account.account2.server": "server2",
 "mail.server.server2.type": "pop3",
 "mail.server.server2.hostname": "pop.firma.pl",
 "mail.server.server2.userName": "biuro@firma.pl",
 "mail.server.server2.name": "biuro@firma.pl",
 "mail.server.server2.directory": m2,
 "mail.server.server2.check_new_mail": False,
 "mail.provider.suppress_dialog_on_startup": True,
 "mail.spotlight.firstRunDone": True,
 "mailnews.start_page.enabled": False,
 "mail.shell.checkDefaultClient": False,
 "app.update.auto": False, "app.update.enabled": False,
 "datareporting.policy.dataSubmissionEnabled": False,
 "extensions.experiments.enabled": True,
 "xpinstall.signatures.required": False,
 "ui.systemUsesDarkTheme": 1 if scheme=="dark" else 0,
 "browser.display.use_system_colors": False,
 "layout.css.prefers-color-scheme.content-override": 0 if scheme=="dark" else 1,
 "extensions.autoDisableScopes": 0,
 "extensions.enabledScopes": 15,
 "browser.dom.window.dump.enabled": True,
}
with open(os.path.join(prof,"user.js"),"w") as f:
    for k,v in prefs.items():
        f.write('user_pref("%s", %s);\n' % (k, str(v).lower() if isinstance(v,bool) else (v if isinstance(v,int) else '"%s"'%v)))
import json
sess={"type":"3pane","tabs":{"rev":0,"selectedIndex":0,"tabs":[{"mode":"mail3PaneTab","state":{"firstTab":True,"folderPaneVisible":True,"folderURI":"mailbox://nobody@Local%20Folders/Inbox","messagePaneVisible":True},"ext":{}}]},"width":1500,"height":900,"screenX":0,"screenY":0}
sess={"windows":[sess]}
json.dump(sess,open(os.path.join(prof,"session.json"),"w"))
print("ok", prof)
