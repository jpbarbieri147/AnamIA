// /api/gerenciar.js — Funcao unica que gerencia pastas (pacientes) e consultas.
// Recebe { access_token, acao, ...params }. Substitui 7 funcoes separadas
// para respeitar o limite de 12 Serverless Functions do plano Hobby do Vercel.
// fetch puro, sem SDK. Toda operacao valida o token e a propriedade (medico_id).

function normalizar(nome){
  if(!nome) return '';
  return String(nome).trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── BASE CID-10 (incorporada do cid.js) ──
const CID_DATA = {"A00":"Colera","A001":"Colera biotipo cholerae","A009":"Colera nao especificada","A01":"Febres tifoide e paratifoide","A010":"Febre tifoide","A019":"Febre paratifoide nao especificada","A02":"Infeccoes por Salmonella","A09":"Diarreia e gastroenterite de origem infecciosa","A15":"Tuberculose respiratoria","A150":"Tuberculose pulmonar confirmada","A162":"Tuberculose pulmonar sem confirmacao","A17":"Tuberculose do sistema nervoso","A170":"Meningite tuberculosa","A18":"Tuberculose de outros orgaos","A180":"Tuberculose ossea","A181":"Tuberculose urogenital","A182":"Tuberculose ganglionar periferica","A183":"Tuberculose intestinal","A19":"Tuberculose miliar","A27":"Leptospirose","A270":"Leptospirose icterohemorragica","A279":"Leptospirose nao especificada","A30":"Hanseniase","A300":"Hanseniase indeterminada","A301":"Hanseniase tuberculoide","A302":"Hanseniase borderline tuberculoide","A303":"Hanseniase borderline","A304":"Hanseniase borderline virchowiana","A305":"Hanseniase virchowiana","A309":"Hanseniase nao especificada","A39":"Infeccao meningococica","A390":"Meningite meningococica","A391":"Septicemia meningococica","A40":"Septicemia por Streptococcus","A41":"Septicemia","A410":"Septicemia por Staphylococcus aureus","A411":"Septicemia por Staphylococcus","A415":"Septicemia gram-negativa","A418":"Outras septicemias","A419":"Septicemia nao especificada","A46":"Erisipela","A50":"Sifilis congenita","A51":"Sifilis precoce","A510":"Sifilis primaria genital","A513":"Sifilis secundaria","A519":"Sifilis precoce nao especificada","A52":"Sifilis tardia","A521":"Neurossifilis sintomatica","A523":"Neurossifilis nao especificada","A529":"Sifilis tardia nao especificada","A539":"Sifilis nao especificada","A54":"Gonorreia","A540":"Gonorreia trato geniturinario inferior","A549":"Gonorreia nao especificada","A56":"Clamidiose","A560":"Clamidiose geniturinaria","A569":"Clamidiose nao especificada","A59":"Tricomoniase","A590":"Tricomoniase urogenital","A599":"Tricomoniase nao especificada","A60":"Herpes anogenital","A600":"Herpes genital","A609":"Herpes anogenital nao especificado","A63":"Verrugas anogenitais","A630":"Condiloma acuminado","A64":"Doenca sexualmente transmissivel nao especificada","A69":"Doenca de Lyme","A692":"Doenca de Lyme","A82":"Raiva","A83":"Encefalite por arbovirus","A87":"Meningite viral","A879":"Meningite viral nao especificada","A90":"Dengue","A91":"Dengue hemorragica","A920":"Chikungunya","A929":"Febre viral por mosquito nao especificada","A95":"Febre amarela","A950":"Febre amarela silvestre","A951":"Febre amarela urbana","A970":"Dengue sem sinal de alarme","A971":"Dengue com sinal de alarme","A972":"Dengue grave","B00":"Herpes simples","B000":"Eczema herpeticum","B002":"Gengivostomatite herpetica","B003":"Meningite herpetica","B004":"Encefalite herpetica","B005":"Herpes ocular","B009":"Herpes simples nao especificado","B01":"Varicela","B019":"Varicela sem complicacoes","B02":"Herpes zoster","B020":"Encefalite por herpes zoster","B022":"Herpes zoster neurologico","B023":"Herpes zoster ocular","B029":"Herpes zoster nao especificado","B05":"Sarampo","B059":"Sarampo sem complicacoes","B06":"Rubeola","B069":"Rubeola sem complicacoes","B07":"Verrugas virais","B079":"Verruga viral nao especificada","B08":"Molusco contagioso","B081":"Molusco contagioso","B15":"Hepatite A","B159":"Hepatite A sem coma","B16":"Hepatite B aguda","B169":"Hepatite B aguda nao especificada","B17":"Hepatite viral aguda","B171":"Hepatite C aguda","B18":"Hepatite viral cronica","B180":"Hepatite B cronica com delta","B181":"Hepatite B cronica","B182":"Hepatite C cronica","B188":"Hepatite viral cronica especificada","B189":"Hepatite viral cronica nao especificada","B20":"HIV com doenca infecciosa","B21":"HIV com neoplasia","B24":"HIV nao especificado","B26":"Caxumba","B269":"Caxumba sem complicacoes","B27":"Mononucleose infecciosa","B279":"Mononucleose nao especificada","B35":"Tinea","B350":"Tinea capitis","B351":"Onicomicose","B352":"Tinea manus","B353":"Tinea pedis","B354":"Tinea corporis","B355":"Tinea imbricata","B356":"Tinea cruris","B359":"Dermatofitose nao especificada","B36":"Micoses superficiais","B360":"Pitiríase versicolor","B37":"Candidose","B370":"Candidose oral","B372":"Candidose cutanea","B373":"Candidose vaginal","B374":"Candidose genital masculina","B375":"Meningite por Candida","B377":"Septicemia por Candida","B379":"Candidose nao especificada","B41":"Paracoccidioidomicose","B419":"Paracoccidioidomicose nao especificada","B44":"Aspergilose","B45":"Criptococose","B50":"Malaria por Plasmodium falciparum","B51":"Malaria por Plasmodium vivax","B54":"Malaria nao especificada","B55":"Leishmaniose","B550":"Leishmaniose visceral","B551":"Leishmaniose cutanea","B552":"Leishmaniose mucocutanea","B559":"Leishmaniose nao especificada","B57":"Doenca de Chagas","B572":"Doenca de Chagas cronica cardiaca","B573":"Doenca de Chagas cronica digestiva","B574":"Doenca de Chagas cronica nervosa","B58":"Toxoplasmose","B589":"Toxoplasmose nao especificada","B65":"Esquistossomose","B651":"Esquistossomose por S. mansoni","B659":"Esquistossomose nao especificada","B77":"Ascaridiase","B80":"Enterobiase","B86":"Escabiose","B87":"Miase","E00":"Hipotiroidismo congenito por deficiencia de iodo","E03":"Hipotiroidismo","E030":"Hipotiroidismo congenito sem bocio","E032":"Hipotiroidismo medicamentoso","E035":"Coma mixedematoso","E039":"Hipotiroidismo nao especificado","E04":"Bocio nao toxico","E040":"Bocio difuso nao toxico","E041":"Bocio uninodular nao toxico","E042":"Bocio multinodular nao toxico","E049":"Bocio nao especificado","E05":"Hipertiroidismo","E050":"Doenca de Graves","E051":"Bocio toxico uninodular","E052":"Bocio toxico multinodular","E055":"Crise tireotoxica","E059":"Hipertiroidismo nao especificado","E06":"Tiroidite","E060":"Tiroidite aguda","E061":"Tiroidite subaguda","E063":"Tiroidite de Hashimoto","E069":"Tiroidite nao especificada","E10":"Diabetes mellitus tipo 1","E100":"DM tipo 1 com coma","E101":"DM tipo 1 com cetoacidose","E102":"DM tipo 1 com nefropatia","E103":"DM tipo 1 com retinopatia","E104":"DM tipo 1 com neuropatia","E105":"DM tipo 1 com angiopatia","E109":"DM tipo 1 sem complicacoes","E11":"Diabetes mellitus tipo 2","E110":"DM tipo 2 com coma","E111":"DM tipo 2 com cetoacidose","E112":"DM tipo 2 com nefropatia","E113":"DM tipo 2 com retinopatia","E114":"DM tipo 2 com neuropatia","E115":"DM tipo 2 com angiopatia","E116":"DM tipo 2 com outras complicacoes","E117":"DM tipo 2 com complicacoes multiplas","E119":"DM tipo 2 sem complicacoes","E14":"Diabetes mellitus nao especificado","E16":"Hipoglicemia","E20":"Hipoparatireoidismo","E21":"Hiperparatireoidismo","E22":"Hiperfuncao da hipofise","E230":"Hipopituitarismo","E24":"Sindrome de Cushing","E25":"Sindrome adrenogenital","E26":"Hiperaldosteronismo","E27":"Insuficiencia suprarrenal","E270":"Doenca de Addison","E28":"Sindrome dos ovarios policisticos","E289":"Disfuncao ovariana nao especificada","E29":"Hipogonadismo masculino","E40":"Kwashiorkor","E41":"Marasmo","E43":"Desnutricao proteico-calorica grave","E44":"Desnutricao moderada","E46":"Desnutricao nao especificada","E55":"Deficiencia de vitamina D","E56":"Outras deficiencias vitaminicas","E66":"Obesidade","E660":"Obesidade exogena","E662":"Sindrome de Pickwick","E669":"Obesidade nao especificada","E78":"Dislipidemias","E780":"Hipercolesterolemia","E781":"Hipertrigliceridemia","E782":"Hiperlipidemia mista","E784":"Outras hiperlipidemias","E785":"Hiperlipidemia nao especificada","E788":"Dislipidemia mista","E789":"Dislipidemia nao especificada","E79":"Gota","E790":"Hiperuricemia assintomatica","E799":"Transtorno do metabolismo das purinas nao especificado","E83":"Transtornos do metabolismo de minerais","E860":"Desidratacao","E870":"Hipernatremia","E871":"Hiponatremia","E872":"Acidose metabolica","E873":"Alcalose metabolica","E875":"Hiperpotassemia","E876":"Hipopotassemia","E879":"Transtorno hidroeletrolitico nao especificado","E88":"Sindrome metabolica","F00":"Demencia de Alzheimer","F009":"Demencia de Alzheimer nao especificada","F01":"Demencia vascular","F019":"Demencia vascular nao especificada","F03":"Demencia nao especificada","F05":"Delirium","F059":"Delirium nao especificado","F10":"Dependencia de alcool","F100":"Intoxicacao aguda por alcool","F101":"Uso nocivo de alcool","F102":"Sindrome de dependencia alcolica","F103":"Abstinencia de alcool","F104":"Delirium tremens","F11":"Dependencia de opioides","F12":"Dependencia de cannabinoides","F14":"Dependencia de cocaina","F17":"Dependencia de nicotina","F19":"Dependencia de multiplas drogas","F20":"Esquizofrenia","F200":"Esquizofrenia paranoide","F209":"Esquizofrenia nao especificada","F25":"Transtorno esquizoafetivo","F31":"Transtorno bipolar","F310":"Hipomania","F311":"Mania sem psicose","F312":"Mania com psicose","F313":"Depressao leve em bipolar","F314":"Depressao grave sem psicose em bipolar","F315":"Depressao grave com psicose em bipolar","F316":"Episodio misto bipolar","F319":"Transtorno bipolar nao especificado","F32":"Episodio depressivo","F320":"Depressao leve","F321":"Depressao moderada","F322":"Depressao grave sem psicose","F323":"Depressao grave com psicose","F329":"Episodio depressivo nao especificado","F33":"Depressao recorrente","F339":"Depressao recorrente nao especificada","F34":"Distimia","F341":"Distimia","F40":"Fobia","F400":"Agorafobia","F401":"Fobia social","F402":"Fobia especifica","F409":"Fobia nao especificada","F41":"Transtorno de ansiedade","F410":"Transtorno do panico","F411":"Ansiedade generalizada","F412":"Transtorno misto ansioso e depressivo","F419":"Transtorno ansioso nao especificado","F42":"TOC - Transtorno obsessivo-compulsivo","F43":"Estresse e adaptacao","F430":"Reacao aguda ao estresse","F431":"TEPT - Transtorno de estresse pos-traumatico","F432":"Transtorno de adaptacao","F44":"Transtorno dissociativo","F45":"Transtorno somatoforme","F450":"Somatizacao","F452":"Hipocondria","F454":"Dor somatoforme","F459":"Transtorno somatoforme nao especificado","F50":"Transtorno alimentar","F500":"Anorexia nervosa","F502":"Bulimia nervosa","F51":"Insonia","F510":"Insonia nao organica","F60":"Transtorno de personalidade","F603":"Borderline - Transtorno de personalidade emocionalmente instavel","F609":"Transtorno de personalidade nao especificado","F70":"Deficiencia intelectual leve","F71":"Deficiencia intelectual moderada","F72":"Deficiencia intelectual grave","F79":"Deficiencia intelectual nao especificada","F84":"Transtorno global do desenvolvimento","F840":"Autismo infantil","F845":"Sindrome de Asperger","F90":"TDAH - Transtorno de deficit de atencao e hiperatividade","F900":"TDAH tipo combinado","F909":"TDAH nao especificado","G00":"Meningite bacteriana","G009":"Meningite bacteriana nao especificada","G03":"Meningite de outra causa","G04":"Encefalite","G05":"Encefalite em doencas","G06":"Abscesso cerebral","G10":"Doenca de Huntington","G20":"Doenca de Parkinson","G21":"Parkinsonismo secundario","G30":"Doenca de Alzheimer","G300":"Alzheimer de inicio precoce","G301":"Alzheimer de inicio tardio","G309":"Alzheimer nao especificado","G35":"Esclerose multipla","G40":"Epilepsia","G400":"Epilepsia focal idiopatica","G403":"Epilepsia generalizada idiopatica","G409":"Epilepsia nao especificada","G41":"Estado de mal epileptico","G43":"Enxaqueca","G430":"Enxaqueca sem aura","G431":"Enxaqueca com aura","G439":"Enxaqueca nao especificada","G44":"Cefaleia","G440":"Cefaleia em salvas","G441":"Hemicrania","G442":"Cefaleia tensional","G449":"Cefaleia nao especificada","G45":"Ataque isquemico transitorio","G459":"AIT nao especificado","G47":"Transtorno do sono","G470":"Insonia","G471":"Hipersonia","G473":"Apneia do sono","G474":"Narcolepsia","G479":"Transtorno do sono nao especificado","G50":"Neuralgia do trigemeo","G51":"Paralisia de Bell","G510":"Paralisia de Bell","G56":"Sindrome do tunel do carpo","G560":"Sindrome do tunel do carpo","G57":"Neuropatia ciatica","G570":"Ciatica","G571":"Meralgia parestesica","G572":"Neuropatia femoral","G60":"Doenca de Charcot-Marie-Tooth","G610":"Sindrome de Guillain-Barre","G70":"Miastenia gravis","G71":"Distrofia muscular","G80":"Paralisia cerebral","G81":"Hemiplegia","G82":"Paraplegia ou tetraplegia","H00":"Hordeolo e calazio","H01":"Blefarite","H10":"Conjuntivite","H100":"Conjuntivite purulenta","H102":"Conjuntivite aguda","H104":"Conjuntivite cronica","H109":"Conjuntivite nao especificada","H16":"Ceratite","H18":"Doenca da cornea","H25":"Catarata senil","H26":"Outras cataratas","H33":"Descolamento de retina","H35":"Doenca da retina","H36":"Retinopatia diabetica","H40":"Glaucoma","H401":"Glaucoma de angulo aberto","H402":"Glaucoma de angulo fechado","H409":"Glaucoma nao especificado","H46":"Neurite optica","H50":"Estrabismo","H52":"Erros de refracao","H520":"Hipermetropia","H521":"Miopia","H522":"Astigmatismo","H524":"Presbiopia","H529":"Erro de refracao nao especificado","H54":"Cegueira e visao subnormal","H60":"Otite externa","H65":"Otite media serosa","H650":"Otite media aguda serosa","H66":"Otite media supurativa","H660":"Otite media supurativa aguda","H661":"Otite media supurativa cronica","H669":"Otite media nao especificada","H70":"Mastoidite","H80":"Otosclerose","H810":"Doenca de Meniere","H811":"Vertigem paroxistica benigna","H812":"Neuronite vestibular","H813":"Vertigem periferica","H819":"Vertigem nao especificada","H90":"Perda de audicao","H91":"Perda de audicao senil","H92":"Otalgia","I00":"Febre reumatica","I05":"Valvopatia mitral reumatica","I06":"Valvopatia aortica reumatica","I10":"Hipertensao arterial essencial","I11":"Cardiopatia hipertensiva","I110":"Cardiopatia hipertensiva com insuficiencia cardiaca","I119":"Cardiopatia hipertensiva sem insuficiencia cardiaca","I12":"Nefropatia hipertensiva","I13":"Cardiopatia e nefropatia hipertensiva","I15":"Hipertensao secundaria","I150":"Hipertensao renovascular","I159":"Hipertensao secundaria nao especificada","I20":"Angina","I200":"Angina instavel","I209":"Angina nao especificada","I21":"Infarto agudo do miocardio","I210":"Infarto anterior transmural","I211":"Infarto inferior transmural","I213":"Infarto transmural nao especificado","I214":"Infarto subendocardico","I219":"IAM nao especificado","I25":"Doenca isquemica cronica do coracao","I250":"Aterosclerose coronaria","I251":"Doenca coronariana","I252":"Infarto antigo","I255":"Cardiomiopatia isquemica","I259":"Doenca isquemica cronica nao especificada","I26":"Tromboembolia pulmonar","I260":"TEP com cor pulmonale","I269":"TEP sem cor pulmonale","I30":"Pericardite aguda","I33":"Endocardite infecciosa","I34":"Insuficiencia mitral","I35":"Estenose ou insuficiencia aortica","I38":"Endocardite valvular nao especificada","I40":"Miocardite aguda","I42":"Cardiomiopatia","I420":"Cardiomiopatia dilatada","I421":"Cardiomiopatia hipertrofica obstrutiva","I422":"Cardiomiopatia hipertrofica nao obstrutiva","I426":"Cardiomiopatia alcoolica","I429":"Cardiomiopatia nao especificada","I44":"Bloqueio atrioventricular","I45":"Bloqueio de ramo","I47":"Taquicardia paroxistica supraventricular","I48":"Fibrilacao atrial","I490":"Fibrilacao ventricular","I50":"Insuficiencia cardiaca","I500":"Insuficiencia cardiaca congestiva","I501":"Insuficiencia ventricular esquerda","I509":"Insuficiencia cardiaca nao especificada","I60":"Hemorragia subaracnoide","I61":"Hemorragia intracerebral","I63":"Infarto cerebral","I64":"AVC nao especificado","I65":"Oclusao arteria pre-cerebral","I66":"Oclusao arteria cerebral","I69":"Sequelas de AVC","I70":"Aterosclerose","I700":"Aterosclerose de aorta","I702":"Aterosclerose de membros","I709":"Aterosclerose generalizada","I71":"Aneurisma de aorta","I72":"Aneurisma arterial","I730":"Fenomeno de Raynaud","I731":"Tromboangeite obliterante","I739":"Doenca vascular periferica nao especificada","I74":"Embolia arterial","I80":"Tromboflebite","I82":"Trombose venosa profunda","I83":"Varizes de membros inferiores","I84":"Hemorroidas","I85":"Varizes esofagianas","J00":"Resfriado comum - nasofaringite aguda","J01":"Sinusite aguda","J010":"Sinusite maxilar aguda","J011":"Sinusite frontal aguda","J012":"Sinusite etmoidal aguda","J019":"Sinusite aguda nao especificada","J02":"Faringite aguda","J020":"Faringite estreptococica","J029":"Faringite aguda nao especificada","J03":"Amigdalite aguda","J030":"Amigdalite estreptococica","J039":"Amigdalite aguda nao especificada","J04":"Laringite aguda","J05":"Crupe","J06":"IVAS - Infeccao vias aereas superiores","J09":"Gripe aviaria","J10":"Influenza","J11":"Gripe nao especificada","J12":"Pneumonia viral","J13":"Pneumonia pneumococica","J14":"Pneumonia por H. influenzae","J15":"Pneumonia bacteriana","J150":"Pneumonia por Klebsiella","J151":"Pneumonia por Pseudomonas","J152":"Pneumonia estafilococica","J157":"Pneumonia por Mycoplasma","J159":"Pneumonia bacteriana nao especificada","J18":"Pneumonia nao especificada","J20":"Bronquite aguda","J209":"Bronquite aguda nao especificada","J21":"Bronquiolite aguda","J30":"Rinite alergica","J300":"Rinite vasomotora","J301":"Rinite alergica por polens","J303":"Rinite alergica perene","J309":"Rinite alergica nao especificada","J32":"Sinusite cronica","J320":"Sinusite maxilar cronica","J329":"Sinusite cronica nao especificada","J33":"Polipo nasal","J35":"Amigdalite cronica e adenoide","J36":"Abscesso periamigdaliano","J37":"Laringite cronica","J38":"Doenca das cordas vocais","J40":"Bronquite nao especificada","J41":"Bronquite cronica","J43":"Enfisema","J439":"Enfisema nao especificado","J44":"DPOC","J440":"DPOC com infeccao","J441":"DPOC com exacerbacao","J449":"DPOC nao especificada","J45":"Asma","J450":"Asma alergica","J451":"Asma nao alergica","J459":"Asma nao especificada","J46":"Estado de mal asmatico","J47":"Bronquiectasia","J62":"Silicose","J67":"Pneumonite de hipersensibilidade","J80":"SARA - Sindrome de angustia respiratoria aguda","J81":"Edema pulmonar agudo","J84":"Doenca pulmonar intersticial","J85":"Abscesso pulmonar","J90":"Derrame pleural","J93":"Pneumotorax","J96":"Insuficiencia respiratoria","J960":"Insuficiencia respiratoria aguda","J961":"Insuficiencia respiratoria cronica","K01":"Dente impactado","K02":"Carie dental","K03":"Desgaste dental","K04":"Abscesso dentario","K05":"Doenca periodontal","K08":"Perda dental","K20":"Esofagite","K21":"Refluxo gastroesofagico - DRGE","K210":"DRGE com esofagite","K219":"DRGE sem esofagite","K25":"Ulcera gastrica","K250":"Ulcera gastrica aguda hemorragica","K253":"Ulcera gastrica aguda","K259":"Ulcera gastrica nao especificada","K26":"Ulcera duodenal","K27":"Ulcera peptica","K29":"Gastrite","K290":"Gastrite hemorragica","K291":"Gastrite aguda","K292":"Gastrite alcoolica","K293":"Gastrite cronica superficial","K294":"Gastrite atrofica","K297":"Gastrite nao especificada","K30":"Dispepsia funcional","K35":"Apendicite aguda com peritonite","K37":"Apendicite nao especificada","K38":"Outras doencas do apendice","K40":"Hernia inguinal","K409":"Hernia inguinal nao especificada","K41":"Hernia femoral","K42":"Hernia umbilical","K43":"Hernia incisional","K44":"Hernia de hiato","K50":"Doenca de Crohn","K500":"Doenca de Crohn intestino delgado","K501":"Doenca de Crohn intestino grosso","K509":"Doenca de Crohn nao especificada","K51":"Retocolite ulcerativa","K519":"Retocolite ulcerativa nao especificada","K52":"Colite nao infecciosa","K57":"Diverticulose","K58":"Sindrome do intestino irritavel","K580":"SII com diarreia","K589":"SII sem diarreia","K59":"Constipacao","K61":"Abscesso retal","K64":"Hemorroidas","K70":"Hepatopatia alcoolica","K72":"Insuficiencia hepatica","K73":"Hepatite cronica","K74":"Cirrose hepatica","K740":"Fibrose hepatica","K746":"Cirrose nao especificada","K76":"Doenca hepatica cronica","K760":"Esteatose hepatica","K766":"Hipertensao portal","K769":"Doenca hepatica nao especificada","K80":"Colelitíase","K800":"Colecistite aguda litiasica","K802":"Colelitíase sem colecistite","K803":"Coledocolitíase com colangite","K81":"Colecistite","K810":"Colecistite aguda","K811":"Colecistite cronica","K819":"Colecistite nao especificada","K85":"Pancreatite aguda","K86":"Pancreatite cronica","K860":"Pancreatite cronica alcoolica","K868":"Outras doencas do pancreas","L01":"Impetigo","L02":"Abscesso e furunculos","L03":"Celulite","L04":"Linfadenite aguda","L05":"Cisto pilonidal","L20":"Dermatite atopica - eczema","L21":"Dermatite seborreica","L23":"Dermatite alergica de contato","L24":"Dermatite irritativa","L25":"Dermatite de contato nao especificada","L29":"Prurido","L40":"Psoriase","L400":"Psoriase vulgar","L405":"Artropatia psoriatica","L409":"Psoriase nao especificada","L50":"Urticaria","L51":"Eritema multiforme","L52":"Eritema nodoso","L55":"Queimadura solar","L63":"Alopecia areata","L64":"Alopecia androgenetica","L65":"Queda de cabelo","L66":"Alopecia cicatricial","L70":"Acne","L700":"Acne vulgar","L709":"Acne nao especificada","L71":"Rosacea","L80":"Vitiligo","L81":"Hiperpigmentacao","L82":"Ceratose seborreica","L83":"Acantose nigricante","L89":"Ulcera de pressao","L97":"Ulcera de perna","L98":"Outras doencas da pele","M00":"Artrite septica","M01":"Artrite infecciosa","M05":"Artrite reumatoide soropositiva","M06":"Artrite reumatoide soronegativa","M07":"Artropatia psoriatica","M08":"Artrite juvenil","M10":"Gota","M100":"Gota idiopatica","M109":"Gota nao especificada","M15":"Poliarttrose","M16":"Artrose de quadril","M160":"Coxartrose primaria bilateral","M169":"Coxartrose nao especificada","M17":"Artrose de joelho","M170":"Gonartrose primaria bilateral","M171":"Gonartrose primaria unilateral","M179":"Gonartrose nao especificada","M19":"Artrose nao especificada","M20":"Joanete - Hallux valgus","M23":"Lesao interna do joelho","M24":"Lesao articular especifica","M25":"Dor articular nao especificada","M32":"Lupus eritematoso sistemico","M329":"LES nao especificado","M33":"Dermatomiosite","M34":"Esclerodermia","M35":"Sindrome de Sjogren","M36":"Artropatia em doencas sistemicas","M40":"Cifose","M41":"Escoliose","M45":"Espondilite anquilosante","M47":"Espondilose","M48":"Estenose de canal vertebral","M50":"Hernia de disco cervical","M51":"Hernia de disco lombar","M510":"Hernia de disco lombossacra com mielopatia","M511":"Hernia de disco lombossacra com radiculopatia","M519":"Hernia de disco nao especificada","M54":"Dorsalgia","M540":"Cervicalgia","M541":"Radiculopatia","M542":"Cervicalgia","M543":"Ciatica","M544":"Lombociatalgia","M545":"Lombalgia","M549":"Dor nas costas nao especificada","M60":"Miosite","M65":"Sinovite e tenossinovite","M67":"Tendinite","M75":"Lesao de ombro","M750":"Ombro congelado - capsulite adesiva","M751":"Sindrome do manguito rotador","M754":"Sindrome do impacto subacromial","M755":"Bursite subacromial","M759":"Lesao de ombro nao especificada","M77":"Epicondilite","M771":"Epicondilite lateral - cotovelo de tenista","M772":"Epicondilite medial - cotovelo de golfista","M79":"Fibromialgia e outros transtornos","M797":"Fibromialgia","M80":"Osteoporose com fratura","M81":"Osteoporose sem fratura","M810":"Osteoporose pos-menopausica","M819":"Osteoporose nao especificada","M83":"Osteomalacia","M86":"Osteomielite","M87":"Osteonecrose","M88":"Doenca de Paget","N00":"Glomerulonefrite aguda","N03":"Glomerulonefrite cronica","N04":"Sindrome nefrotica","N17":"Lesao renal aguda","N170":"LRA com necrose tubular","N179":"LRA nao especificada","N18":"Doenca renal cronica","N180":"DRC estadio final","N181":"DRC estadio 1","N182":"DRC estadio 2","N183":"DRC estadio 3","N184":"DRC estadio 4","N185":"DRC estadio 5","N189":"DRC nao especificada","N19":"Insuficiencia renal nao especificada","N20":"Calculose renal","N200":"Calculo do rim","N201":"Calculo do ureter","N209":"Calculose nao especificada","N23":"Colica renal","N30":"Cistite","N300":"Cistite aguda","N309":"Cistite nao especificada","N34":"Uretrite","N39":"Infeccao urinaria","N390":"ITU - Infeccao do trato urinario","N393":"Incontinencia urinaria de esforco","N394":"Incontinencia urinaria de urgência","N399":"Transtorno urinario nao especificado","N40":"Hiperplasia prostatica benigna","N41":"Prostatite","N410":"Prostatite aguda","N411":"Prostatite cronica","N419":"Prostatite nao especificada","N42":"Doenca da prostata","N45":"Orquite e epididimite","N46":"Infertilidade masculina","N48":"Disfuncao eretil","N60":"Displasia mamaria benigna","N61":"Mastite","N63":"Nodulo mamario","N64":"Mastodinia","N70":"Doenca inflamatoria pelvica - DIP","N71":"Endometrite","N72":"Cervicite","N73":"DIP nao especificada","N76":"Vulvovaginite","N80":"Endometriose","N800":"Endometriose uterina","N801":"Endometriose ovariana","N809":"Endometriose nao especificada","N81":"Prolapso uterino","N83":"Cisto de ovario","N84":"Polipo uterino","N85":"Hiperplasia de endometrio","N87":"Displasia do colo do utero - NIC","N88":"Ectopia cervical","N90":"Cisto de Bartholin","N91":"Amenorreia","N92":"Menorragia","N93":"Sangramento uterino anormal","N94":"Dismenorreia","N940":"Dismenorreia","N941":"Dispareunia","N943":"Sindrome pre-menstrual - SPM","N949":"Afeccao ginecologica nao especificada","N95":"Sindrome do climatério","N950":"Sangramento pos-menopausico","N951":"Sintomas da menopausa","N952":"Vaginite atrofica","N959":"Menopausa nao especificada","N97":"Infertilidade feminina","R00":"Palpitacoes","R01":"Sopro cardiaco","R03":"Hipertensao sem diagnostico","R04":"Epistaxe - sangramento nasal","R05":"Tosse","R06":"Dispneia","R07":"Dor toracica","R09":"Outros sintomas cardiorrespiratorios","R10":"Dor abdominal","R100":"Abdome agudo","R101":"Dor epigastrica","R104":"Dor abdominal difusa","R11":"Nausea e vomito","R12":"Pirose","R13":"Disfagia","R15":"Incontinencia fecal","R16":"Hepatomegalia","R17":"Ictericia","R18":"Ascite","R20":"Dormencia e formigamento","R21":"Eruppcao cutanea","R22":"Massa ou nodulo","R25":"Tremor","R26":"Alteracao da marcha","R30":"Disuria","R31":"Hematuria","R32":"Incontinencia urinaria","R33":"Retencao urinaria","R35":"Poliuria","R39":"Sintomas urinarios nao especificados","R40":"Coma","R41":"Confusao mental","R42":"Tontura e vertigem","R43":"Anosmia","R44":"Alucinacao","R47":"Afasia","R48":"Dislexia","R50":"Febre sem causa aparente","R51":"Cefaleia","R52":"Dor cronica","R53":"Fadiga e astenia","R55":"Sincope","R56":"Convulsao","R57":"Choque","R58":"Hemorragia nao especificada","R59":"Linfadenopatia","R60":"Edema","R62":"Atraso no desenvolvimento","R63":"Anorexia","R64":"Caquexia","R70":"VHS elevada","R73":"Hiperglicemia","R74":"Enzimas hepaticas alteradas","R75":"Teste positivo para HIV","R79":"Exame bioquimico alterado","R80":"Proteinuria","R81":"Glicosuria","R82":"Exame de urina alterado","R90":"TC de cranio alterada","R91":"Imagem pulmonar alterada","R93":"Exame de imagem alterado","R94":"Exame funcional alterado","Z00":"Consulta de rotina","Z001":"Check-up infantil","Z008":"Check-up adulto","Z009":"Exame nao especificado","Z01":"Exame preventivo","Z02":"Exame admissional","Z08":"Seguimento pos-cancer","Z09":"Seguimento pos-tratamento","Z10":"Exame de saude ocupacional","Z11":"Rastreio de doencas infecciosas","Z12":"Rastreio de cancer","Z13":"Rastreio de outras doencas","Z20":"Contato com doenca contagiosa","Z21":"Portador assintomatico de HIV","Z22":"Portador de doenca infecciosa","Z23":"Vacinacao contra doencas bacterianas","Z24":"Vacinacao contra doencas virais","Z26":"Vacinacao","Z28":"Vacinacao nao realizada","Z30":"Anticoncepcao","Z31":"Planejamento familiar","Z32":"Teste de gravidez","Z33":"Gravidez confirmada","Z34":"Pre-natal de baixo risco","Z35":"Pre-natal de alto risco","Z51":"Quimioterapia","Z512":"Radioterapia","Z515":"Cuidados paliativos","Z54":"Convalescenca","Z72":"Tabagismo","Z720":"Tabagismo","Z721":"Alcoolismo","Z722":"Uso de drogas","Z73":"Burnout","Z74":"Dependencia de cuidadores","Z75":"Falta de acesso a servico de saude","Z80":"Historia familiar de cancer","Z81":"Historia familiar de doenca mental","Z82":"Historia familiar de doencas cronicas","Z85":"Cancer previo","Z86":"Historia pessoal de outras doencas","Z87":"Historia pessoal","Z88":"Alergia a medicamentos","Z89":"Amputacao","Z91":"Historia de riscos","Z93":"Ostomia","Z94":"Transplante de orgaos","Z95":"Implante cardiovascular","Z96":"Implante funcional","Z98":"Estado pos-cirurgico","Z99":"Dependencia de dispositivos"};
const CID_LIST = Object.entries(CID_DATA).map(([code,desc])=>({code,desc}));


export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPA_URL = process.env.SUPABASE_URL;
  const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPA_URL || !SECRET_KEY) return res.status(500).json({ error: 'Supabase env vars missing' });

  const H = { 'Content-Type': 'application/json', 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + SECRET_KEY };

  try {
    const body = req.body || {};
    const { access_token, acao } = body;
    if (!access_token) return res.status(401).json({ error: 'Missing access_token' });
    if (!acao) return res.status(400).json({ error: 'Missing acao' });

    // Valida token -> dono (uma vez, vale para todas as acoes)
    const userResp = await fetch(SUPA_URL + '/auth/v1/user', {
      method: 'GET', headers: { 'apikey': SECRET_KEY, 'Authorization': 'Bearer ' + access_token }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid token' });
    const user = await userResp.json();
    if (!user || !user.id) return res.status(401).json({ error: 'Could not resolve user from token' });
    const uid = user.id;

    // ===================== PERFIL DO MÉDICO =====================

    if (acao === 'perfil_get') {
      const perfUrl = SUPA_URL + '/rest/v1/medicos'
        + '?select=id,nome,crm,uf_crm,cpf,especialidade,telefone,email_contato,cep,rua,numero,complemento,bairro,cidade,uf_endereco'
        + '&id=eq.' + encodeURIComponent(uid)
        + '&limit=1';
      const perfResp = await fetch(perfUrl, { method: 'GET', headers: H });
      if (!perfResp.ok) return res.status(500).json({ error: 'Perfil get failed: ' + await perfResp.text() });
      const perfData = await perfResp.json();
      if (!perfData || perfData.length === 0) return res.status(404).json({ error: 'Perfil nao encontrado' });
      return res.status(200).json({ perfil: perfData[0] });
    }

    if (acao === 'perfil_update') {
      const { nome, crm, uf_crm, cpf, especialidade, telefone, email_contato,
              cep, rua, numero, complemento, bairro, cidade, uf_endereco } = body;
      const nomeLimpo = nome ? String(nome).trim() : '';
      if (!nomeLimpo) return res.status(400).json({ error: 'Nome obrigatorio' });
      const updUrl = SUPA_URL + '/rest/v1/medicos'
        + '?id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          nome: nomeLimpo,
          crm: crm ? String(crm).trim() : null,
          uf_crm: uf_crm ? String(uf_crm).trim().toUpperCase() : null,
          cpf: cpf ? String(cpf).replace(/\D/g, '') : null,
          especialidade: especialidade ? String(especialidade).trim() : null,
          telefone: telefone ? String(telefone).trim() : null,
          email_contato: email_contato ? String(email_contato).trim() : null,
          cep: cep ? String(cep).trim() : null,
          rua: rua ? String(rua).trim() : null,
          numero: numero ? String(numero).trim() : null,
          complemento: complemento ? String(complemento).trim() : null,
          bairro: bairro ? String(bairro).trim() : null,
          cidade: cidade ? String(cidade).trim() : null,
          uf_endereco: uf_endereco ? String(uf_endereco).trim().toUpperCase() : null
        })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Perfil update failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Perfil nao encontrado' });
      return res.status(200).json({ perfil: updated[0] });
    }

    // ===================== AGENDA =====================

    if (acao === 'agenda_list') {
      const { ano, mes } = body;
      if (!ano || !mes) return res.status(400).json({ error: 'Missing ano or mes' });
      const mm = String(parseInt(mes)).padStart(2,'0');
      const yyyy = parseInt(ano);
      const dataInicio = `${yyyy}-${mm}-01`;
      const mesNext = parseInt(mes) === 12 ? 1 : parseInt(mes) + 1;
      const yearNext = parseInt(mes) === 12 ? yyyy + 1 : yyyy;
      const mmNext = String(mesNext).padStart(2,'0');
      const dataFim = `${yearNext}-${mmNext}-01`;
      const url = SUPA_URL + '/rest/v1/agendamentos'
        + '?select=id,paciente_id,paciente_nome,data,hora,tipo,status,observacoes,email_paciente,modalidade,convenio_nome'
        + '&medico_id=eq.' + encodeURIComponent(uid)
        + '&data=gte.' + dataInicio
        + '&data=lt.' + dataFim
        + '&order=data.asc,hora.asc';
      const r = await fetch(url, { method: 'GET', headers: H });
      if (!r.ok) return res.status(500).json({ error: 'List failed: ' + await r.text() });
      return res.status(200).json({ agendamentos: await r.json() });
    }

    if (acao === 'agenda_create') {
      const { paciente_id, paciente_nome, data, hora, tipo, status, observacoes, email_paciente, modalidade, convenio_nome } = body;
      if (!paciente_nome || !data || !hora) return res.status(400).json({ error: 'Missing required fields' });
      const r = await fetch(SUPA_URL + '/rest/v1/agendamentos', {
        method: 'POST',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          medico_id: uid,
          paciente_id: paciente_id || null,
          paciente_nome: String(paciente_nome).trim(),
          data, hora,
          tipo: tipo || 'retorno',
          status: status || 'agendado',
          observacoes: observacoes || null,
          email_paciente: email_paciente || null,
          modalidade: modalidade || 'particular',
          convenio_nome: convenio_nome || null
        })
      });
      if (!r.ok) return res.status(500).json({ error: 'Create failed: ' + await r.text() });
      const created = await r.json();
      return res.status(200).json({ agendamento: created[0] });
    }

    if (acao === 'agenda_update') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const updUrl = SUPA_URL + '/rest/v1/agendamentos'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const patch = {};
      ['paciente_id','paciente_nome','data','hora','tipo','status','observacoes','email_paciente','modalidade','convenio_nome'].forEach(function(f){ if (body[f] !== undefined) patch[f] = body[f]; });
      const r = await fetch(updUrl, {
        method: 'PATCH',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify(patch)
      });
      if (!r.ok) return res.status(500).json({ error: 'Update failed: ' + await r.text() });
      const updated = await r.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Agendamento nao encontrado' });
      return res.status(200).json({ agendamento: updated[0] });
    }

    if (acao === 'agenda_delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const delUrl = SUPA_URL + '/rest/v1/agendamentos'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const r = await fetch(delUrl, {
        method: 'DELETE',
        headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
      });
      if (!r.ok) return res.status(500).json({ error: 'Delete failed: ' + await r.text() });
      const deleted = await r.json();
      if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Agendamento nao encontrado' });
      return res.status(200).json({ ok: true, id: body.id });
    }

    // ===================== PACIENTES (PASTAS) =====================

    if (acao === 'pacientes_list') {
      const { q } = body;
      let pacUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?select=id,nome,cpf,sexo,data_nascimento,telefone,endereco,created_at,updated_at'
        + '&medico_id=eq.' + encodeURIComponent(uid)
        + '&order=nome.asc';
      if (q) pacUrl += '&nome_normalizado=ilike.' + encodeURIComponent('*' + normalizar(q) + '*');
      const pacResp = await fetch(pacUrl, { method: 'GET', headers: H });
      if (!pacResp.ok) return res.status(500).json({ error: 'List pacientes failed: ' + await pacResp.text() });
      const pacientes = await pacResp.json();

      const consUrl = SUPA_URL + '/rest/v1/consultas'
        + '?select=id,paciente_id,created_at'
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const consResp = await fetch(consUrl, { method: 'GET', headers: H });
      const consultas = consResp.ok ? await consResp.json() : [];

      const agg = {};
      let semPasta = 0;
      for (let i = 0; i < consultas.length; i++) {
        const c = consultas[i];
        if (!c.paciente_id) { semPasta++; continue; }
        if (!agg[c.paciente_id]) agg[c.paciente_id] = { count: 0, ultima: null };
        agg[c.paciente_id].count++;
        if (!agg[c.paciente_id].ultima || c.created_at > agg[c.paciente_id].ultima) {
          agg[c.paciente_id].ultima = c.created_at;
        }
      }
      const out = pacientes.map(function(p){
        const a = agg[p.id] || { count: 0, ultima: null };
        return { id: p.id, nome: p.nome, cpf: p.cpf, sexo: p.sexo,
                 data_nascimento: p.data_nascimento, telefone: p.telefone,
                 endereco: p.endereco, created_at: p.created_at, updated_at: p.updated_at,
                 num_consultas: a.count, ultima_consulta: a.ultima };
      });
      return res.status(200).json({ pacientes: out, sem_pasta: semPasta });
    }

    if (acao === 'pacientes_create') {
      const { nome, cpf, sexo, data_nascimento, telefone, endereco } = body;
      const nomeLimpo = nome ? String(nome).trim() : '';
      if (!nomeLimpo) return res.status(400).json({ error: 'Nome obrigatório' });
      const nomeNorm = normalizar(nomeLimpo);
      const cpfLimpo = cpf ? String(cpf).replace(/\D/g, '') : null;

      // Verifica duplicata por nome normalizado
      const findUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?select=id,nome&medico_id=eq.' + encodeURIComponent(uid)
        + '&nome_normalizado=eq.' + encodeURIComponent(nomeNorm) + '&limit=1';
      const findResp = await fetch(findUrl, { method: 'GET', headers: H });
      if (findResp.ok) {
        const found = await findResp.json();
        if (found && found.length > 0) return res.status(409).json({ error: 'Já existe um paciente com esse nome', id: found[0].id, nome: found[0].nome });
      }

      const createResp = await fetch(SUPA_URL + '/rest/v1/pacientes', {
        method: 'POST', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          medico_id: uid,
          nome: nomeLimpo,
          nome_normalizado: nomeNorm,
          cpf: cpfLimpo || null,
          sexo: sexo || null,
          data_nascimento: data_nascimento || null,
          telefone: telefone ? String(telefone).trim() : null,
          endereco: endereco ? String(endereco).trim() : null
        })
      });
      if (!createResp.ok) return res.status(500).json({ error: 'Create failed: ' + await createResp.text() });
      const created = await createResp.json();
      return res.status(200).json(created[0] || {});
    }

    if (acao === 'pacientes_update') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const { id, nome, cpf, sexo, data_nascimento, telefone, endereco } = body;
      const nomeLimpo = nome ? String(nome).trim() : '';
      if (!nomeLimpo) return res.status(400).json({ error: 'Nome obrigatório' });
      const cpfLimpo = cpf ? String(cpf).replace(/\D/g, '') : null;
      const updUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?id=eq.' + encodeURIComponent(id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({
          nome: nomeLimpo,
          nome_normalizado: normalizar(nomeLimpo),
          cpf: cpfLimpo || null,
          sexo: sexo || null,
          data_nascimento: data_nascimento || null,
          telefone: telefone ? String(telefone).trim() : null,
          endereco: endereco ? String(endereco).trim() : null,
          updated_at: new Date().toISOString()
        })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Update failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Paciente não encontrado' });
      return res.status(200).json(updated[0]);
    }

    if (acao === 'pacientes_delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const delUrl = SUPA_URL + '/rest/v1/pacientes'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const delResp = await fetch(delUrl, {
        method: 'DELETE', headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
      });
      if (!delResp.ok) return res.status(500).json({ error: 'Delete failed: ' + await delResp.text() });
      const deleted = await delResp.json();
      if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Pasta nao encontrada' });
      return res.status(200).json({ ok: true, id: body.id });
    }

    // ===================== CONSULTAS =====================

    if (acao === 'consulta_update') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const tituloLimpo = (body.titulo !== undefined && body.titulo !== null) ? String(body.titulo).trim() : '';
      const updUrl = SUPA_URL + '/rest/v1/consultas'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ titulo: tituloLimpo || null })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Update failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ id: body.id, titulo: tituloLimpo });
    }

    if (acao === 'consulta_delete') {
      if (!body.id) return res.status(400).json({ error: 'Missing id' });
      const delUrl = SUPA_URL + '/rest/v1/consultas'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const delResp = await fetch(delUrl, {
        method: 'DELETE', headers: Object.assign({}, H, { 'Prefer': 'return=representation' })
      });
      if (!delResp.ok) return res.status(500).json({ error: 'Delete failed: ' + await delResp.text() });
      const deleted = await delResp.json();
      if (!deleted || deleted.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ ok: true, id: body.id });
    }

    if (acao === 'consulta_mover') {
      if (!body.id) return res.status(400).json({ error: 'Missing consulta id' });
      const novoPacienteId = body.paciente_id || null;
      const updUrl = SUPA_URL + '/rest/v1/consultas'
        + '?id=eq.' + encodeURIComponent(body.id)
        + '&medico_id=eq.' + encodeURIComponent(uid);
      const updResp = await fetch(updUrl, {
        method: 'PATCH', headers: Object.assign({}, H, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ paciente_id: novoPacienteId })
      });
      if (!updResp.ok) return res.status(500).json({ error: 'Move failed: ' + await updResp.text() });
      const updated = await updResp.json();
      if (!updated || updated.length === 0) return res.status(404).json({ error: 'Consulta nao encontrada' });
      return res.status(200).json({ ok: true, id: body.id, paciente_id: novoPacienteId });
    }

    // ── CID_BUSCAR ──
    if (acao === 'cid_buscar') {
      const q = String(body.q || '');
      if (!q || q.length < 2) return res.status(200).json({ results: [] });
      function normCid(s) {
        return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim();
      }
      const qn = normCid(q);
      const qUp = q.toUpperCase().replace(/\./g, '').trim();
      const priority = [], secondary = [];
      for (const item of CID_LIST) {
        const c = item.code.replace(/\./g, '');
        if (c.startsWith(qUp)) { priority.push(item); if (priority.length >= 8) break; }
        else if (priority.length + secondary.length < 20 && normCid(item.desc).includes(qn)) secondary.push(item);
      }
      return res.status(200).json({ results: [...priority, ...secondary].slice(0, 10) });
    }

    // ── AUDIT_LOG ──
    if (acao === 'audit_log') {
      const { log_acao, log_recurso, log_recurso_id, log_detalhes } = body;
      if (!log_acao || !log_recurso) return res.status(400).json({ error: 'log_acao e log_recurso obrigatórios' });

      const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;

      await fetch(SUPA_URL + '/rest/v1/audit_log', {
        method: 'POST',
        headers: Object.assign({}, H, { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }),
        body: JSON.stringify({
          medico_id: uid,
          acao: log_acao,
          recurso: log_recurso,
          recurso_id: log_recurso_id || null,
          detalhes: log_detalhes || null,
          ip: ip ? String(ip).split(',')[0].trim() : null
        })
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Acao desconhecida: ' + acao });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
