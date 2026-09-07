const dataModel = {
  // System level data

  userRoles: {
    userRoles001: {
      userRolesId: 'userRoles001',
      userRolesName: 'System Owner',
      userRolesScope: 'System',
    },
    userRoles002: {
      userRolesId: 'userRoles002',
      userRolesName: 'System Admin',
      userRolesScope: 'System',
    },
    userRoles003: {
      userRolesId: 'userRoles003',
      userRolesName: 'League Owner',
      userRolesScope: 'League',
    },
    userRoles004: {
      userRolesId: 'userRoles004',
      userRolesName: 'League Admin',
      userRolesScope: 'League',
    },
    userRoles005: {
      userRolesId: 'userRoles005',
      userRolesName: 'Manager',
      userRolesScope: 'League',
    },
    userRoles006: {
      userRolesId: 'userRoles006',
      userRolesName: 'Primary Auctioneer',
      userRolesScope: 'League',
    },
    userRoles007: {
      userRolesId: 'userRoles007',
      userRolesName: 'Secondary Auctioneer',
      userRolesScope: 'League',
    },
    userRoles008: {
      userRolesId: 'userRoles008',
      userRolesName: 'Spectator',
      userRolesScope: 'League',
    },
    userRoles009: {
      userRolesId: 'userRoles009',
      userRolesName: 'BannedFromLeague',
      userRolesScope: 'League',
    },
  },

  standardAuctionConfig: {
    playerDetails: {
      player001: {
        playerCategory: 'playerCategory001',
        playerBasePrice: 5,
      },
      player002: {
        playerCategory: 'playerCategory002',
        playerBasePrice: 3,
      },
      player003: {
        playerCategory: 'playerCategory001',
        playerBasePrice: 5,
      },
      player004: {
        playerCategory: 'playerCategory003',
        playerBasePrice: 2,
      },
    },
    minSquadSize: 13,
    maxSquadSize: 20,
    // Seeds the create form's Max slots field when the auction toggle is on.
    // It is NOT copied into leagues/{lid}/auctionDetails/auctionConfig — the
    // league stores its slot count once, at leagues/{lid}/maxSlots.
    slots: 6,
    totalBudget: 100,
    maxOverseasPlayersAllowedInXI: 4,
  },

  standardFantasyLineupRules: {
    playerRole001: {
      min: 2,
      max: null,
    },
    playerRole002: {
      min: 2,
      max: 4,
    },
    playerRole003: {
      min: 1,
      max: null,
    },
    playerRole004: {
      min: 1,
      max: null,
    },
  },

  // Seeds the create form's "Team changes deadline" field. 0 means teams lock
  // at match start. Like standardAuctionConfig.slots, it is a default for the
  // form and is NOT resolved at read time — the league copies the chosen value
  // at creation and owns it from then on.
  standardFantasyLeagueTeamChangesDeadlineOffset: 0,

  users: {
    // systemUserId: systemUserObject
    user001: {
      userId: 'user001',
      userName: 'Aalhad',
      googleIdentifier: 'googleIdentifier001',
      googleEmailId: 'aalhad@gmail.com',
      systemUserRoles: { userRoles001: true, userRoles002: true },
      /*
        TBD1.1 RESOLVED: yes — a leagues index is required, not optional.

        RTDB cannot answer "which leagues contain this user as a member" —
        there is no way to filter across the leagues node on a nested key.
        Without this index the My Leagues page is unbuildable. That also means
        THIS INDEX CANNOT BE REBUILT: lose an entry and the user loses the
        league from the UI permanently. Every write that moves an entry must be
        a single atomic multi-path update().

        The fields below are DENORMALISED COPIES, chosen to be what the My
        Leagues card renders without dragging the league's gameweek and auction
        config along with it.

        NOT stored here, and this is settled:
        - League LIFECYCLE status (Pre-auction / Auction phase / Team submission
          / Active / Finished) is DERIVED at read time. It is a function of the
          current time, and Phase 1 has no server to write it when a deadline
          passes, so it is not storable at all.
        - slotsUsed / filledSlots is derived by counting
          leagues/{lid}/leagueMembers. A counter here would fan out to EVERY
          member's entry on every join, which is the most frequent write in the
          model.
        - finishedAt and auctionStartTime are NOT copied either, even though
          they change once or rarely so the fan-out objection does not apply.
          Copying them would make status derivation free, but a failed fan-out
          leaves one member's entry permanently wrong — and since archiving
          keys off finishedAt, that member's league would then never archive.
          A read is always right; a stale copy is silently and permanently
          wrong.

        CONSEQUENCE, accepted: the My Leagues card is NOT one read. It is this
        index plus a few narrow reads per league — leagueMembers for the count,
        finishedAt / auctionStartTime for the status, the live auction phase for
        auction leagues — plus ONE read per distinct tournament, not per league.
        Realistically under ten leagues, usually about five.

        tournamentId is carried so the tournament can be fetched in parallel
        rather than after reading the league. It is immutable, since a league
        covers one tournament for life, so it carries no staleness risk.

        membershipStatus IS stored here, because it is a fact about this user's
        relationship to the league rather than about the league itself.

        Renames still fan out. That is an atomic multi-path update() with at
        most ~8 paths — extra write work, not risk. ownerName and tournamentName
        are the riskiest copies, because they change independently of the league.
      */
      leagues: {
        league001: {
          leagueName: 'IPL 2027 - Official League',
          tournamentId: 'tournament001',
          tournamentName: 'IPL 2027',
          isAuctionEnabled: false,
          ownerName: 'Aalhad',
          maxSlots: 200,
          /*
            WRITTEN, not derived, and written at exactly two moments: when a
            join request is accepted, and when it is rejected.

            No 'Banned' value. Banning does not touch this field — it strips
            userRoles005 and adds userRoles009 on the membership record, and
            myRoles below carries that, so a card can tell a banned user
            without a second source of truth for the same fact.
          */
          membershipStatus: 'Accepted', // Pending | Accepted | Rejected
          myRoles: {
            userRoles003: true,
            userRoles004: true,
            userRoles005: true,
          },
        },
        league002: {
          leagueName: "IPL 2027 - Yogesh's Auction League",
          tournamentId: 'tournament001',
          tournamentName: 'IPL 2027',
          isAuctionEnabled: true,
          ownerName: 'Yogesh',
          maxSlots: 6,
          membershipStatus: 'Accepted',
          myRoles: { userRoles008: true }, // spectator in this league
        },
      },
      /*
        ARCHIVED LEAGUES — a separate node, not a status on the entry above.

        A league belongs here once finishedAt is set AND the current time is
        past finishedAt + 24h, which is what the Archived tab means. Phase 1 has
        no scheduler, so nothing moves it at that moment: getActiveLeagues does
        the move lazily, for this user's own entries only, whenever it meets one
        that has crossed the boundary. Each user writes only their own subtree,
        so there is no contention and repeating it is harmless.

        WHY A SEPARATE NODE rather than a flag on the entry:
        reads are subtree-shaped, so with everything under leagues/ a single
        read drags the whole archive along with the active leagues, and the My
        Leagues tab boundary is a filter wearing a tab's clothes. Status is
        derived, so the index cannot be queried around it either. Archived is
        also the only category that grows without bound — pending and rejected
        stay small.

        THE MOVE IS ONE ATOMIC update() writing this path and deleting
        users/{uid}/leagues/{lid} together. Never a write then a delete: this
        index cannot be rebuilt (see TBD1.1).

        THE RECORD MOVES UNCHANGED, plus the snapshot below. The archived CARD
        renders less; the record does not shrink, because a shrunk record cannot
        be moved back.

        finalRank / finalManagerCount are the ONE exception to "points are never
        stored per manager". That rule exists so corrections propagate, and
        marking a league finished is precisely the assertion that no corrections
        remain — so the value is immutable from that moment, and computing it on
        every visit would mean reading the whole lineup subtree for a number
        that can never change. Computed once, at migration. BEST EFFORT: if the
        leaderboard computation fails, the move still happens and the card omits
        the position. No retry machinery in Phase 1.
      */
      archivedLeagues: {
        league003: {
          leagueName: 'IPL 2026 - Office League',
          tournamentId: 'tournament000',
          tournamentName: 'IPL 2026',
          isAuctionEnabled: true,
          ownerName: 'Aalhad',
          maxSlots: 6,
          membershipStatus: 'Accepted',
          myRoles: { userRoles005: true },
          archivedAt: 1806500000000,
          finalRank: 3,
          finalManagerCount: 6,
        },
      },
      // TBD1.2 RESOLVED: no. League roles live on the league membership record
      //                  (leagues/{lid}/leagueMembers/{uid}/leagueRoles). Not duplicated here.
    },
    user002: {
      userId: 'user002',
      userName: 'Yogesh',
      googleIdentifier: 'googleIdentifier002',
      googleEmailId: 'yogesh@gmail.com',
      systemUserRoles: { userRoles002: true },
      leagues: {
        // same shape as user001 above
        league002: {
          leagueName: "IPL 2027 - Yogesh's Auction League",
          tournamentName: 'IPL 2027',
          isAuctionEnabled: true,
          ownerName: 'Yogesh',
          maxSlots: 6,
          membershipStatus: 'Accepted',
          myRoles: {
            userRoles003: true,
            userRoles004: true,
            userRoles006: true,
          },
        },
      },
    },
    user003: {
      userId: 'user003',
      userName: 'Ninad',
      googleIdentifier: 'googleIdentifier003',
      googleEmailId: 'ninad@gmail.com',
      systemUserRoles: {},
      leagues: {
        // same shape as user001 above
        league002: {
          leagueName: "IPL 2027 - Yogesh's Auction League",
          tournamentName: 'IPL 2027',
          isAuctionEnabled: true,
          ownerName: 'Yogesh',
          maxSlots: 6,
          membershipStatus: 'Accepted',
          myRoles: { userRoles005: true },
        },
      },
    },
  },

  /*
        TBD2 RESOLVED (deferred to implementation):
        "googleIdentifier" is deliberately non-committal — it may end up being
        the google user id or the google email id. Which one is decided at
        implementation time in Claude Code, based on how firebase google auth
        actually behaves. Everything above and below refers to it by this name
        so the model does not need to change either way.
    */
  googleIdentifierToUserIdMapping: {
    // googleIdentifier: systemUserId
    googleIdentifier001: 'user001',
    googleIdentifier002: 'user002',
  },

  /*
    TBD3 RESOLVED: keep it as a lookup table.
    Unlike leagueType and scoringSystem (TBD8/TBD9, which became booleans),
    formats will genuinely carry data of their own — once formal scoring rules
    exist, they are defined format-wise and belong here.
  */
  formats: {
    // formatId:
    format001: {
      formatId: 'format001',
      formatName: 'T20',
    },
    format002: {
      formatId: 'format002',
      formatName: 'ODI',
    },
    format003: {
      formatId: 'format003',
      formatName: 'Test',
    },
  },

  competitions: {
    // competitionId: competitionObject
    competition001: {
      competitionId: 'competition001',
      competitionName: 'IPL',
      formatId: 'format001',
    },
    competition002: {
      competitionId: 'competition002',
      competitionName: 'ODI World Cup',
      formatId: 'format002',
    },
    competition003: {
      competitionId: 'competition003',
      competitionName: 'Test Series',
      formatId: 'format003',
    },
  },

  teams: {
    // teamId: teamObject
    team001: {
      teamId: 'team001',
      teamName: 'Royal Challengers Bengaluru',
      teamShortName: 'RCB',
      competitionIds: { competition001: true },
      playerIds: {
        competition001: { player001: true, player002: true },
      },
    },
    team002: {
      teamId: 'team002',
      teamName: 'India',
      teamShortName: 'IND',
      competitionIds: { competition002: true, competition003: true },
      playerIds: {
        // competitionId: map of player ids
        competition002: { player001: true, player003: true },
        competition003: { player003: true },
      },
    },
    team003: {
      teamId: 'team003',
      teamName: 'Australia',
      teamShortName: 'AUS',
      competitionIds: { competition002: true, competition003: true },
      playerIds: {
        // competitionId: map of player ids
        competition002: { player002: true },
        competition003: { player002: true },
      },
    },
    team004: {
      teamId: 'team004',
      teamName: 'Mumbai Indians',
      teamShortName: 'MI',
      competitionIds: { competition001: true },
      playerIds: {
        competition001: { player003: true, player004: true },
      },
    },
  },

  playerRoles: {
    playerRole001: {
      playerRoleId: 'playerRole001',
      playerRoleName: 'Batsman',
      playerRoleShortName: 'BAT',
      playerRoleIcon: '', // this is the emoji style icon that should be shown in front of player name in fantasy lineup. like a bat in front of batsman, ball infront of bowler, gloves in front of keeper etc
    },
    playerRole002: {
      playerRoleId: 'playerRole002',
      playerRoleName: 'Bowler',
      playerRoleShortName: 'BL',
      playerRoleIcon: '',
    },
    playerRole003: {
      playerRoleId: 'playerRole003',
      playerRoleName: 'Wicket Keeper',
      playerRoleShortName: 'WK',
      playerRoleIcon: '',
    },
    playerRole004: {
      playerRoleId: 'playerRole004',
      playerRoleName: 'All Rounder',
      playerRoleShortName: 'ALL',
      playerRoleIcon: '',
    },
  },

  playerCategories: {
    playerCategory001: {
      playerCategoryId: 'playerCategory001',
      playerCategoryName: 'Marquee',
      playerCategoryAuctionFormat: 'Auction',
    },
    playerCategory002: {
      playerCategoryId: 'playerCategory002',
      playerCategoryName: 'Star',
      playerCategoryAuctionFormat: 'Auction',
    },
    playerCategory003: {
      playerCategoryId: 'playerCategory003',
      playerCategoryName: 'General',
      playerCategoryAuctionFormat: 'Draft',
    },
  },

  players: {
    // playerId: playerObject
    player001: {
      playerId: 'player001',
      playerName: 'Virat Kohli',
      playerShortName: 'Kohli',
      country: 'India',
      currentTeams: {
        competition001: 'team001',
        competition002: 'team002',
      },
      playerRole: 'playerRole001',
      isRetired: false, // fully retired from everything. Format-level retirement is expressed by absence from currentTeams
      /*
				TBD4 RESOLVED: no per-format retirement matrix.
				it can't just be for format, because for example kohli is retired from
				T20s but still plays T20 in IPL, and mapping by competition is too much
				overhead. Instead, retiring from a format simply removes that team from
				currentTeams — when kohli retires from ODI, delete the
				competition002: team002 mapping.

				isRetired above covers the one case absence cannot: a fully retired
				player has an empty currentTeams, otherwise indistinguishable from a
				newly created player not yet assigned to any team.
			*/
    },
    player002: {
      playerId: 'player002',
      playerName: 'Glen Maxwell',
      playerShortName: 'Maxwell',
      country: 'Australia',
      currentTeams: {
        competition001: 'team001',
        competition002: 'team003',
        competition003: 'team003',
      },
      playerRole: 'playerRole004',
      isRetired: false,
    },
    player003: {
      playerId: 'player003',
      playerName: 'Jasprit Bumrah',
      playerShortName: 'Bumrah',
      country: 'India',
      currentTeams: {
        competition001: 'team004',
        competition002: 'team002',
        competition003: 'team002',
      },
      playerRole: 'playerRole002',
      isRetired: false,
    },
    player004: {
      playerId: 'player004',
      playerName: 'Mayank Markande',
      country: 'India',
      playerShortName: 'Markande',
      currentTeams: {
        competition001: 'team004',
      },
      playerRole: 'playerRole002',
      isRetired: false,
    },
  },

  tournaments: {
    // tournamentId: tournamentObject
    tournament001: {
      tournamentId: 'tournament001',
      tournamentName: 'IPL 2027',
      competitionId: 'competition001',
      /*
        AUTHORITATIVE FOR READS, MAINTAINED ON WRITE.

        Nothing derives tournament timing by walking the match list. These two
        are the source, and every write that changes a match start time
        recomputes them in the SAME atomic multi-path update() — otherwise they
        drift and every reader is wrong at once.

        startDate = the earliest match's startTimestamp.
        endDate   = the latest match's startTimestamp. Both are START times;
                    whether a match has ENDED is computed the same way it is
                    everywhere else, by adding the format's duration (see
                    08-pages/my-team.md).

        endDate is NULL while ANY match is undated, which is what makes
        "published with only match 1 dated" work: the card simply shows no end
        date. Consistent with TBD7 — absence means not yet known.

        endDate does NOT drive tab membership. A tournament stays Active until
        an admin marks it complete; see completedAt above.
      */
      /*
        Two deliberate admin actions, stored as nullable timestamps rather than
        booleans — same cost, and they record WHEN.

        publishedAt gates everything user-facing: an unpublished tournament does
        not appear in the tournament list and cannot have a league created
        against it. Gated on at least the first match having a start time.

        completedAt is the admin asserting the tournament is over, and it is
        what moves it to the Past tab. Prompted when the last match's points are
        entered, but never set automatically, because the admin may still be
        adding matches they forgot.

        WHY NOT DERIVE PAST FROM endDate: endDate is the last match's START
        time, and a match is not over when it starts. A Test runs five days. A
        tournament would drop into Past while its final was still being played.
        Adding a format duration would work most of the time and be wrong on
        rain delays and early finishes, so the tab follows the human instead.

        These are the tournament-level counterpart to a league's finishedAt: the
        documented exception to lifecycle being derived, because only a person
        knows when the last correction has landed.

        Absent means not yet, as everywhere else. Note Firebase deletes a key
        written as null, so the read path must treat ABSENT as "not published"
        and "not complete".
      */
      publishedAt: 1806000000000,
      completedAt: null,
      startDate: 1806431400000,
      endDate: 1811701800000,
      participatingTeams: { team001: true, team004: true },
      /*
        TBD5 RESOLVED: participatingPlayers was a flat array, so it could not
        answer "which team is this player in FOR THIS TOURNAMENT".
        Replaced by the dual mapping below — participatingPlayers maps each
        player to their team, and participatingTeamPlayers is the reverse.
      */
      participatingPlayers: {
        // playerId: teamId, for this tournament only
        player001: 'team001',
        player002: 'team001',
        player003: 'team004',
        player004: 'team004',
      },
      participatingTeamPlayers: {
        // teamId: { playerId: true } — reverse of participatingPlayers
        team001: { player001: true, player002: true },
        team004: { player003: true, player004: true },
      },
      matches: {
        // matchId: matchObject
        match001: {
          matchId: 'match001',
          matchNumber: 1,
          team1Id: 'team001',
          team2Id: 'team002',
          startTimestamp: 1806431400000,
          // TBD6 RESOLVED: keep it, but OPTIONAL. It is extra work for the system
          // admin, so if the field is absent we simply do not display a venue.
          venue: 'Mumbai',
        },
        /* Assume 59 more matches here, till 60 */
        match061: {
          matchId: 'match061',
          matchNumber: 61,
          // TBD7 RESOLVED: store null, display "TBD" at runtime.
          // Note firebase deletes a key whose value is null, so the read path must
          // treat an ABSENT team1Id/team2Id as "not yet announced".
          team1Id: null,
          team2Id: null,
          startTimestamp: 1811442600000,
        },
        /* Assume 3 more matches here, till 64 */
      },
      rounds: {
        // roundId: roundObject
        round001: {
          roundId: 'round001',
          roundName: 'Group Stage',
          firstMatchId: 'match001',
          lastMatchId: 'match060',
          eliminatedTeams: {}, // this is eliminatedTeams instead of qualifiedTeams, because then people can select their team even if system admin doesn't update this on time. system admin update doesn't block anything
        },
        round002: {
          roundId: 'round002',
          roundName: 'Play Offs',
          firstMatchId: 'match061',
          lastMatchId: 'match064',
          eliminatedTeams: {},
        },
      },

      /*
        [D12] Thin index for the tournament detail page (spec 9L), which lists
        every league for this tournament — public and closed alike — with a
        join / request-to-join action on each row.

        WHY AN INDEX AT ALL:
        leagues are stored globally keyed by leagueId, and RTDB cannot filter
        that node by tournamentId without one. The alternatives were both worse:
          - orderByChild("tournamentId").equalTo(...) works, but returns WHOLE
            league objects — round configs, auction settings, members — for
            every league, just to render a six-field row.
          - an id-only index means N reads of full leagues, same payload with
            an extra hop.

        NOT stored here, deliberately, and both are consequences of decisions
        made earlier:
          - lifecycle status is DERIVED, never stored
          - slotsUsed is DERIVED by counting leagues/{lid}/leagueMembers

        OPEN QUESTION for implementation:
        if this page needs slots-remaining to show whether a league is
        joinable, deriving it means reading each league's members anyway —
        which defeats the point of a thin index. Either accept a row that does
        not show slot availability, or accept the extra reads on this one page.
      */
      leagues: {
        league001: {
          leagueName: 'IPL 2027 - Official League',
          isAuctionEnabled: false,
          leagueEntry: 'Open',
          maxSlots: 200,
        },
        league002: {
          leagueName: "IPL 2027 - Yogesh's Auction League",
          isAuctionEnabled: true,
          leagueEntry: 'Private',
          maxSlots: 6,
        },
      },
    },
    tournament002: {},
  },

  // League level data
  leagues: {
    // leagueId: leagueObject
    league001: {
      leagueId: 'league001',
      leagueName: 'IPL 2027 - Official League',
      leagueOwner: 'user001',
      leagueJoinCode: 'leagueJoinCode001',
      isAuctionEnabled: false,
      // TBD8 RESOLVED: boolean flag rather than a leagueTypes lookup table.
      // There are only ever two values, and a table for a boolean is overhead
      // with no payoff — the per-type customisations that would have justified
      // a table are actually per LEAGUE (round configs, change allowances),
      // and those already live on the league. Also consistent with isAuctionEnabled.
      // false = match based. Forced true when isAuctionEnabled is true (code-enforced).
      isGameWeeksEnabled: false,
      tournamentId: 'tournament001',
      leagueEntry: 'Open',
      totalChangesAllowed: 11,
      totalCaptainChangesAllowed: 11,
      totalViceCaptainChangesAllowed: 11,
      // TBD9 RESOLVED: boolean flag rather than a scoringSystems lookup table.
      // The scoring "system" holds no rules of its own — under the A/B points
      // model, standard points live at tournament level and custom points at
      // league level, and the human-readable description lives in
      // scoringRulesText below. A lookup table would only ever hold two rows.
      // false = standard points (option A).
      isCustomScoringSystem: false,
      // TBD10 RESOLVED: no unlimited slots in phase 1. 200 is the ceiling, and
      // the default for an open/official league. Keeps the field a single type.
      // Lowered from 1000: the realistic Phase 1 ceiling is a few dozen
      // managers, and the leaderboard is one subtree read of every manager's
      // lineups, sized for tens rather than thousands.
      maxSlots: 200,
      fantasyLineupRules: {
        // Copied from standardFantasyLineupRules at creation, same as the
        // auction config and for the second reason given there: managers pick
        // their XI against these, so a standard edited mid-season must not
        // silently change what counts as a legal team.
      },
      leagueMembers: {
        user001: {
          fantasyTeamName: 'Aalhad XI',
          leagueRoles: {
            userRoles003: true,
            userRoles004: true,
            userRoles005: true,
          }, // this means the user is league owner, league admin, and manager
          /*
            Cumulative effect of accepted transfers on this manager's total.
            Always 0 in a non-auction league, since there are no transfers.

            Kept as a running total rather than recomputed from the transfer
            history, because it is the ONE thing the leaderboard needs that is
            not derivable from player points. The individual per-transfer
            amounts remain in transferProposals, so this can always be
            reconstructed if it ever drifts.
          */
          pointsAdjustment: 0,
          // [A1] matchWiseFantasyConfigs moved to the top-level lineups node
        },
        user002: {
          fantasyTeamName: "Yogesh's Warriors",
          leagueRoles: { userRoles005: true }, // the player is just manager
          pointsAdjustment: 0,
          // [A1] matchWiseFantasyConfigs moved to the top-level lineups node
        },
      },
      // ALWAYS PRESENT. Written at creation, seeded from
      // standardFantasyLeagueTeamChangesDeadlineOffset. There is no fallback at
      // read time: managers commit against their deadline, so a standard edited
      // mid-season must not shift lock times under them.
      fantasyLeagueTeamChangesDeadlineOffset: 30 * 1000 * 60,
      fantasyLeagueJoinDeadline: 1806431400000,
      finishedAt: null, // once league is marked finished, this will have a timestamp
      /*
        TBD11 RESOLVED: review pass complete — nothing structural was missing.
        What the review did surface has since been added: fantasyLeagueJoinDeadline,
        fantasyLeagueTeamChangesDeadlineOffset, finishedAt, pointsAdjustment on
        each manager, and the standard/custom points nodes.

        One deliberate ABSENCE worth recording: there is no overseas-player cap
        here. maxOverseasPlayersAllowedInXI exists only in auctionConfig. A
        regular league is meant to be about freedom of selection, not
        constraint — the overseas rule belongs to auction leagues, where it
        mirrors real IPL rules and adds a strategic dimension.
      */
    },
    league002: {
      leagueId: 'league002',
      leagueName: "IPL 2027 - Yogesh's Auction League",
      leagueOwner: 'user002',
      leagueJoinCode: 'leagueJoinCode002',
      isAuctionEnabled: true,
      isGameWeeksEnabled: true, // forced true because isAuctionEnabled is true — enforced through code, cannot be expressed as a database rule
      tournamentId: 'tournament001',
      leagueEntry: 'Private',
      isCustomScoringSystem: true, // option B — league admin enters their own points
      scoringRulesText: 'some long multiline text',
      // The ONLY place a slot count is stored. Defaulted from
      // standardAuctionConfig.slots on the create form, then owned by the
      // league. Capped at 8 when isAuctionEnabled — enforced in code, not in
      // the database.
      maxSlots: 6,
      fantasyLineupRules: {
        playerRole001: {
          min: 3,
          max: 5,
        },
        playerRole002: {
          min: 2,
          max: 3,
        },
        playerRole003: {
          min: 1,
          max: 3,
        },
        playerRole004: {
          min: 1,
          max: 2,
        },
      },
      roundConfigs: {
        round001: {
          maxNumberOfChangesAllowedBeforeRoundStart: null, // infinite, so keeping null, consistent with other such values
          maxNumberOfChangesAllowedBetweenGameWeeks: null, // also infinite
          isImpactSubAllowed: true,
          // there are total 60 matches in this round. so that needs to strictly be divisible by numberOfGameWeeks - enforced in code and UI, not in database
          gameWeeks: {
            gameWeek001: {
              gameWeekId: 'gameWeek001',
              gameWeekName: 'Game Week 1',
              gameWeekNumber: 1,
              startMatchId: 'match001',
              endMatchId: 'match010',
            },
            /* 5 more game weeks like this*/
          },
        },
        round002: {
          maxNumberOfChangesAllowedBeforeRoundStart: null,
          maxNumberOfChangesAllowedBetweenGameWeeks: null,
          isImpactSubAllowed: false,
          gameWeeks: {
            gameWeek007: {
              gameWeekId: 'gameWeek007',
              gameWeekName: 'Qualifier 1',
              gameWeekNumber: 7,
              startMatchId: 'match061',
              endMatchId: 'match061',
            },
            gameWeek008: {
              gameWeekId: 'gameWeek008',
              gameWeekName: 'Eliminator',
              gameWeekNumber: 8,
              startMatchId: 'match062',
              endMatchId: 'match062',
            },
            gameWeek009: {
              gameWeekId: 'gameWeek009',
              gameWeekName: 'Qualifier 2',
              gameWeekNumber: 9,
              startMatchId: 'match063',
              endMatchId: 'match063',
            },
            gameWeek010: {
              gameWeekId: 'gameWeek010',
              gameWeekName: 'Final',
              gameWeekNumber: 10,
              startMatchId: 'match064',
              endMatchId: 'match064',
            },
          },
        },
      },
      leagueMembers: {
        user001: {
          leagueRoles: { userRoles008: true }, // spectator
        },
        user002: {
          leagueRoles: {
            userRoles003: true,
            userRoles004: true,
            userRoles006: true,
          }, // owner, admin, primary auctioneer, but not manager
        },
        user003: {
          fantasyTeamName: 'Thane Thunders',
          leagueRoles: { userRoles005: true }, // manager
          // asked for and received 500 points in transferProposal001 (accepted)
          pointsAdjustment: 500,
          // [A1] matchWiseSquads moved to top-level squads node
          // [A1] gameWeekWiseFantasyConfigs moved to top-level lineups node
          // [A1] transferProposalsReceived / Sent moved to top-level transferProposalsByManager node
        },
        user004: {
          fantasyTeamName: 'Magical Miraj',
          leagueRoles: { userRoles005: true },
          // gave up 500 points in transferProposal001 (accepted)
          pointsAdjustment: -500,
          // [A1] matchWiseSquads moved to top-level squads node
          // [A1] gameWeekWiseFantasyConfigs moved to top-level lineups node
          // [A1] transferProposalsReceived / Sent moved to top-level transferProposalsByManager node
        },
      },
      auctionDetails: {
        auctionConfig: {
          lastUpdatedBy: {
            user: 'user002',
            timestamp: 1806085800000,
          },
          /*
            If not overridden we copy budget and the relevant playerDetails
            from standardAuctionConfig here, rather than marking the league
            "standard" and resolving by fallback.

            COPYING IS DELIBERATE, not laziness. standardAuctionConfig
            .playerDetails holds every player in the SYSTEM; a league needs only
            the players participating in ITS tournament. So this is not a
            snapshot of the standard, it is a PROJECTION of it onto one
            tournament — a smaller and genuinely different set. Resolving by
            fallback would mean reading every player in the system on every read
            and intersecting against the tournament's participants.

            It also has to be frozen: managers bid against these values, so a
            standard edited mid-season must not retroactively change what a
            completed auction appears to have run under.

            Points are the ONLY standard that resolves dynamically, because
            points get corrected and a correction must reach every league.

            NO slots FIELD HERE, deliberately. The slot count lives ONCE, on
            leagues/{lid}/maxSlots. standardAuctionConfig.slots still exists and
            still does its job — it seeds the create form — but it is not
            propagated into the league. Two writable fields holding one number
            can only ever desync, and they already disagreed in this file.
            The auction ceiling of 8 is a validation on maxSlots conditioned on
            isAuctionEnabled, which is where it has to live anyway.
          */
          playerDetails: {
            player001: {
              playerCategory: 'playerCategory001',
              playerBasePrice: 6,
            },
            player002: {
              playerCategory: 'playerCategory002',
              playerBasePrice: 4,
            },
            player003: {
              playerCategory: 'playerCategory001',
              playerBasePrice: 6,
            },
            player004: {
              playerCategory: 'playerCategory003',
              playerBasePrice: 2,
            },
          },
          totalBudget: 100,
          // Two flat fields rather than a { min, max } pair, matching
          // maxOverseasPlayersAllowedInXI below. The draft needs the maximum:
          // a manager who can no longer pick is skipped, which cannot be
          // evaluated without it.
          minSquadSize: 13,
          maxSquadSize: 20,
          // TBD13 RESOLVED: null means NO limit. Consistent with TBD7 — let the
          // data convey absence rather than encoding it as a magic number.
          maxOverseasPlayersAllowedInXI: 4,
        },
        transferWindows: {
          transferWindow001: {
            transferWindowId: 'transferWindow001',
            startMatchId: 'match031',
            endMatchId: 'match040',
          },
        },
        draftOrder: {
          // or it will be empty if not decided yet
          user003: 1,
          user004: 5,
          user005: 3,
          user006: 2,
          user007: 6,
          user008: 4,
        },
        auctionStartTime: 1806345000000,
        /*
          DELIBERATE DUPLICATION of the auctioneer roles on the membership
          record (userRoles006 / userRoles007). Kept because it makes the common
          read cheap: showing a manager who the auctioneer is should not mean
          fetching every member and scanning their role maps for one flag. One
          extra field costs nothing.

          The role map stays the thing permission is checked against, as it is
          for every other capability. These two are the fast copy for display.

          BOTH ARE WRITTEN IN ONE ATOMIC MULTI-PATH update() on handover. That
          is the same tool that makes every other denormalised copy in this
          model safe, and it matters more here than anywhere else: a handover
          happens mid-auction, which is the worst possible moment for the two to
          disagree about who holds control.
        */
        primaryAuctioneer: 'user002',
        secondaryAuctioneer: null, // while creating the league, this has to be null, so it's allowed to be null
      },
      // ALWAYS PRESENT. Written at creation, seeded from
      // standardFantasyLeagueTeamChangesDeadlineOffset. There is no fallback at
      // read time: managers commit against their deadline, so a standard edited
      // mid-season must not shift lock times under them.
      fantasyLeagueTeamChangesDeadlineOffset: 30 * 1000 * 60,
      fantasyLeagueJoinDeadline: 1806431400000,
      finishedAt: null, // once league is marked finished, this will have a timestamp
      /*
        TBD11 RESOLVED: review pass complete. draftOrder was added to
        auctionDetails above, and the whole live auction runtime now exists at
        top level under liveAuctions/{leagueId}.

        Still deferred to Phase 2, deliberately: auctioneer PRESENCE tracking
        and an inactivity threshold for automatic backup promotion. For Phase 1
        the admin or owner monitors the auctioneer and reassigns manually.
      */
    },
  },

  leagueCodeToLeagueMapping: {
    leagueCode001: 'league001', // actual code is 8 alphanumeric characters, generated at league creation; collisions are detected by reading this mapping and retried
    leagueCode002: 'league002',
  },

  /*
    ===========================================================
    POINTS — option A of the A/B scoring model.

    Entered once by a system admin at tournament level, and used by every
    league whose isCustomScoringSystem is false.

    Stored BOTH ways:
      standardPointsByMatch  : tournamentId / matchId  / playerId
      standardPointsByPlayer : tournamentId / playerId / matchId

    NOTE — REVISIT AT IMPLEMENTATION:
    Unlike every other dual mapping in this model, this one duplicates VALUES
    rather than relationships (elsewhere one side just stores `true`). That
    means a points correction has to write both paths in the same atomic
    multi-path update(), or the two copies diverge silently.

    Keeping both for now, but during implementation check which mapping is
    actually being used and actually serving its purpose:
      - match-major serves points entry and the leaderboard
      - player-major serves "this player's season so far"
    If both earn their place, keep both. If only one is doing real work,
    drop the other and remove the dual-write requirement with it.
    ===========================================================
  */
  standardPointsByMatch: {
    tournament001: {
      match001: {
        player001: 76,
        player002: 21,
        player003: 0, // 0 and absent are equivalent — the reason a player scored nothing is not recorded
        player004: 45,
      },
      match002: {
        player001: 12,
        player003: 88,
      },
    },
  },

  standardPointsByPlayer: {
    tournament001: {
      player001: {
        match001: 76,
        match002: 12,
      },
      player002: {
        match001: 21,
      },
      player003: {
        match001: 0,
        match002: 88,
      },
      player004: {
        match001: 45,
      },
    },
  },

  /*
    ===========================================================
    CUSTOM POINTS — option B.

    Only exists for leagues where isCustomScoringSystem is true. The league
    admin calculates and enters these themselves.

    RESOLUTION IS FALLBACK, NEVER A COPY:
    a league reads its own store first and falls back to standardPoints.
    Standard points are never copied into a league — otherwise correcting a
    scoring mistake would mean fixing it in every league that opted in, which
    is the fan-out problem this model avoids everywhere else.

    Stored both ways for the same reason as standard points, and carrying the
    same revisit-at-implementation note.
    ===========================================================
  */
  customPointsByMatch: {
    league002: {
      match001: {
        player001: 152, // this league doubles all batting points, hence different from standard
        player002: 42,
        player003: 0,
        player004: 90,
      },
    },
  },

  customPointsByPlayer: {
    league002: {
      player001: {
        match001: 152,
      },
      player002: {
        match001: 42,
      },
      player003: {
        match001: 0,
      },
      player004: {
        match001: 90,
      },
    },
  },

  // =========================================================
  // [A2] LINEUPS — moved out of leagues/{lid}/leagueMembers/{uid}
  // Shape and density are UNCHANGED from v1. Both league types keep their
  // original field names; only the location has moved.
  // =========================================================

  lineups: {
    league001: {
      // match based league — was matchWiseFantasyConfigs
      user001: {
        match001: {
          lineup: ['player001', 'player003', 'player004'], // this would be exactly 11, enforced in code, not in db
          captainId: 'player001',
          viceCaptainId: 'player004',
          changesRemaining: 11,
          captainChangesRemaining: 11,
          viceCaptainChangesRemaining: 11,
        },
        match002: {
          lineup: ['player001', 'player002', 'player004'], // this would be exactly 11, enforced in code, not in db
          captainId: 'player001',
          viceCaptainId: 'player002',
          changesRemaining: 10,
          captainChangesRemaining: 11,
          viceCaptainChangesRemaining: 10,
        },
        // like this, for every single match. initially, same team copied for every match. and on every update of match X, copy the same team for matches X to last match of the tournament
      },
      user002: {
        // will have the same shape, not repeating, example is already there
      },
    },
    league002: {
      // game week based league — was gameWeekWiseFantasyConfigs
      user003: {
        gameWeek001: {
          startingLineup: ['player001', 'player002', 'player004'],
          captainId: 'player004',
          viceCaptainId: 'player001',
          impactSub: {
            playerIdOut: 'player002',
            playerIdIn: 'player003',
            applicableFromMatch: 'match002',
          },
          postImpactSubLineup: ['player001', 'player003', 'player004'],
        },
      },
      user004: {
        gameWeek001: {
          startingLineup: ['player011', 'player013', 'player007'],
          captainId: 'player011',
          viceCaptainId: 'player013',
          impactSub: null,
          postImpactSubLineup: null,
        },
      },
    },
  },

  // =========================================================
  // [A3] SQUADS — moved out of leagues/{lid}/leagueMembers/{uid}
  // Auction leagues only. Shape and density UNCHANGED from v1.
  // =========================================================

  squads: {
    league002: {
      user003: {
        // exists only for auction league
        match001: ['player001', 'player002', 'player003', 'player004'],
        match002: ['player001', 'player002', 'player003', 'player004'],
        // assume more entries
        match034: ['player001', 'player002', 'player007', 'player004'], // player003<->player007 transfer
        /*
          TBD12 RESOLVED — DEFERRED, keeping match-keyed for Phase 1.
          The idea: key squads by gameWeekId instead, so a transfer only takes
          effect once the current game week ends, rather than mid-week.
          Deferred because game-week-based leagues are not running until IPL
          2027, so it makes no practical difference to Phase 1. Taking it later
          would also make transferProposals.applicableFromMatch a game week
          reference instead of a match reference.
        */
      },
      user004: {
        // exists only for auction league
        match001: ['player011', 'player012', 'player013', 'player007'],
        match002: ['player011', 'player012', 'player013', 'player007'],
        // assume more entries
        match034: ['player011', 'player012', 'player013', 'player003'], // player003<->player007 transfer
        /*
          TBD12 RESOLVED — DEFERRED, keeping match-keyed for Phase 1.
          The idea: key squads by gameWeekId instead, so a transfer only takes
          effect once the current game week ends, rather than mid-week.
          Deferred because game-week-based leagues are not running until IPL
          2027, so it makes no practical difference to Phase 1. Taking it later
          would also make transferProposals.applicableFromMatch a game week
          reference instead of a match reference.
        */
      },
    },
  },

  // =========================================================
  // [A5] Per-manager transfer proposal indexes — moved out of
  // leagues/{lid}/leagueMembers/{uid}. Content UNCHANGED from v1,
  // including shortSummary.
  // =========================================================

  transferProposalsByManager: {
    league002: {
      user003: {
        transferProposalsReceived: {
          transferProposal002: {
            proposedBy: 'user004',
            shortSummary: '', // instead of copying everything here, we can just copy some textual summary, like 2 players offered including X, 1 player demanded including Y. Z points offered, etc
            status: 'Pending',
          },
          transferProposal003: {
            proposedBy: 'user004',
            shortSummary: '',
            status: 'Rejected',
          },
        },
        transferProposalsSent: {
          transferProposal001: {
            proposedTo: 'user004',
            shortSummary: '',
            status: 'Accepted',
          },
        },
      },
      user004: {
        transferProposalsReceived: {
          transferProposal001: {
            proposedBy: 'user003',
            shortSummary: '',
            status: 'Accepted',
          },
        },
        transferProposalsSent: {
          transferProposal002: {
            proposedTo: 'user003',
            shortSummary: '',
            status: 'Pending',
          },
          transferProposal003: {
            proposedTo: 'user003',
            shortSummary: '',
            status: 'Rejected',
          },
        },
      },
    },
  },

  // =========================================================
  // [A4] JOIN REQUESTS — in v1 these sat inside the leagues node as a
  // sibling of league001/league002, so they were scoped to no league.
  // Now scoped under league002. Content UNCHANGED.
  // =========================================================

  /*
    Keyed by userId, so "does this user have a request for this league" is a
    direct read rather than a scan.

    REJECTED AND ACCEPTED ENTRIES ARE BOTH KEPT, not deleted. Accepted ones
    are retained as a record but are NOT shown in the UI — once someone is a
    member, the member list is where you look for them, and a second list of
    accepted requests beside it would say the same thing twice.

    RE-REQUESTING OVERWRITES the same record, flipping status back to Pending.
    That loses the history of prior rejections, which nothing consumes, and it
    is what lets userId stay the key.

    resolvedAt / resolvedBy deliberately omitted — appeals are out of Phase 1,
    so there is no consumer for that audit trail.
  */
  joinRequests: {
    league002: {
      user005: {
        fantasyTeamName: 'My XI',
        leagueRoleRequested: 'userRoles005', // join request as manager. hence fantasyTeamName exists
        requestedAt: 1806300000000, // lets the admin sort the queue
        status: 'Pending', // Pending | Accepted | Rejected
      },
      user006: {
        leagueRoleRequested: 'userRoles008', // join request as spectator
        requestedAt: 1806310000000,
        status: 'Rejected', // soft reject — this user may request again
      },
    },
  },

  /*
    ===========================================================
    BANNED USERS

    A SEPARATE NODE rather than a "Banned" value on the join request, because
    the ban check happens at a different moment than the request check. In an
    OPEN league, joining needs no approval and there is no join request to
    consult — but a banned user must still be turned away. So a ban has to be
    independently checkable at a known path.

    It also covers the case where the banned person was a member who never
    filed a request.

    RESOLVED: an EXISTING member CAN be banned mid-season, and nothing is
    removed. The ban strips userRoles005 (Manager) and adds userRoles009
    (BannedFromLeague) on their leagueMembers record. Their squad, lineups and
    pointsAdjustment all survive, which matters in an auction league where the
    banned manager owns a squad they paid for. Slot counting and the
    leaderboard already filter by the Manager role, so they drop out of both
    automatically with no special case.

    This node stays required regardless, for the reason above: in an OPEN
    league there is no join request to consult, so a ban needs to be checkable
    at a known path.
    ===========================================================
  */
  bannedUsers: {
    league002: {
      // user007 is illustrative — not defined elsewhere in this example file
      user007: {
        bannedAt: 1806400000000,
        bannedBy: 'user002', // the admin who issued the ban
      },
    },
  },

  // =========================================================
  // [A5] TRANSFER PROPOSALS — same relocation as join requests.
  // Content UNCHANGED.
  // =========================================================

  transferProposals: {
    league002: {
      transferProposal001: {
        manager1: 'user003',
        manager2: 'user004',
        proposedBy: 'user003',
        playersOfferedByManager1: ['player003'],
        playersAskedFromManager2: ['player007'],
        pointsOffered: 0,
        pointsAsked: 500, // either pointsOffered will be non-zero, or pointsAsked will be non-zero - enforced in code, not in db
        status: 'Accepted',
        applicableFromMatch: 'match034',
      },
      transferProposal002: {
        manager1: 'user004',
        manager2: 'user003',
        proposedBy: 'user004',
        playersOfferedByManager1: ['player011'],
        playersAskedFromManager2: ['player001'],
        pointsOffered: 0,
        pointsAsked: 0, // either pointsOffered will be non-zero, or pointsAsked will be non-zero, or both can be 0. but both cannot be non-zero - enforced in code, not in db
        status: 'Pending',
      },
      transferProposal003: {
        manager1: 'user004',
        manager2: 'user003',
        proposedBy: 'user004',
        playersOfferedByManager1: ['player013'],
        playersAskedFromManager2: ['player003'],
        pointsOffered: 0,
        pointsAsked: 0, // either pointsOffered will be non-zero, or pointsAsked will be non-zero, or both can be 0. but both cannot be non-zero - enforced in code, not in db
        status: 'Rejected',
        rejectionReason: 'Rejected by manager', // this can be "Player transfered to someone else" or "Invalid proposal" or "No response within transfer window" etc
      },
    },
  },

  /*
    Global reference table — identical for every auction, so it lives at top
    level alongside userRoles / playerRoles / playerCategories rather than
    inside liveAuctions. Keeping it as a sibling of the league keys inside
    liveAuctions would recreate the collision pattern fixed for joinRequests.
  */
  liveAuctionPhases: {
    phase001: {
      phaseId: 'phase001',
      phaseName: 'NotStarted',
      phaseDescription: 'Not Started',
    },
    phase002: {
      // auction has started, but no bidding is live right now — between one
      // player being resolved and the next going up. Named "Between Players"
      // rather than "Idle", because Idle wrongly suggests managers can step
      // away when the next player can go up at any moment.
      phaseId: 'phase002',
      phaseName: 'BetweenPlayers',
      phaseDescription: 'Between Players',
    },
    phase003: {
      phaseId: 'phase003',
      phaseName: 'Bidding',
      phaseDescription: 'Bidding',
    },
    phase004: {
      phaseId: 'phase004',
      phaseName: 'Paused',
      phaseDescription: 'Paused',
    },
    phase005: {
      phaseId: 'phase005',
      phaseName: 'TimeUp',
      phaseDescription: 'TimeUp',
    },
    phase006: {
      phaseId: 'phase006',
      phaseName: 'Sold',
      phaseDescription: 'Sold',
    },
    phase007: {
      phaseId: 'phase007',
      phaseName: 'Unsold',
      phaseDescription: 'Unsold',
    },
    phase008: {
      /*
        The auctioneer made a mistake, or went absent and an admin is stepping
        in. Entered DELIBERATELY — the auctioneer clicks something like
        "Recover" — and only while in this phase can past sells and unsold
        results be undone. That gate is the point of having a phase at all
        rather than letting rewind fire at any moment.

        It may also cover an admin reassigning the auctioneer mid-auction.

        MECHANICS DEFERRED TO IMPLEMENTATION, deliberately and not by oversight:
        what exactly enters and leaves it, how far back a rewind may go, and who
        may do either. Not a Phase 1 priority.
      */
      phaseId: 'phase008',
      phaseName: 'Recovering',
      phaseDescription: 'Recovering',
    },
    phase009: {
      phaseId: 'phase009',
      phaseName: 'Ended',
      phaseDescription: 'Ended',
    },
  },

  /*
    Global reference table, same reasoning as liveAuctionPhases.

    This is the EVENT CATALOGUE — the set of things that can happen in an
    auction, each with the parameters its message needs. Actual occurrences go
    to liveAuctions/{lid}/timeline, which stores an event id plus its data
    rather than a pre-rendered string (spec 9Q).
  */
  timelineEvents: {
    timelineEvent001: {
      timelineEventId: 'timelineEvent001',
      timelineEventType: 'AuctionStarted',
      timelineEventDescription: 'Auction Started',
      params: [],
    },
    timelineEvent002: {
      timelineEventId: 'timelineEvent002',
      timelineEventType: 'NextBatch',
      timelineEventDescription: 'Next batch of players selected',
      params: ['playerCategory', 'playerRole'],
    },
    timelineEvent003: {
      timelineEventId: 'timelineEvent003',
      timelineEventType: 'NextPlayer',
      timelineEventDescription: 'Next player bidding started',
      params: ['playerId', 'basePrice', 'timeLimit'],
    },
    timelineEvent004: {
      timelineEventId: 'timelineEvent004',
      timelineEventType: 'Bid',
      timelineEventDescription: 'Bid accepted for current player',
      params: ['playerId', 'bid', 'managerId'],
    },
    timelineEvent005: {
      timelineEventId: 'timelineEvent005',
      timelineEventType: 'NoBid',
      timelineEventDescription: 'No bid accepted for current player',
      params: ['playerId', 'managerId'],
    },
    timelineEvent006: {
      timelineEventId: 'timelineEvent006',
      timelineEventType: 'Paused',
      timelineEventDescription: 'Bidding paused',
      params: [],
    },
    timelineEvent007: {
      timelineEventId: 'timelineEvent007',
      timelineEventType: 'AuctionRestarted',
      timelineEventDescription: 'Bidding restarted',
      params: [],
    },
    timelineEvent008: {
      timelineEventId: 'timelineEvent008',
      timelineEventType: 'AuctionBeingRecovered',
      timelineEventDescription: 'Auction is being recovered to valid state',
      params: [],
    },
    timelineEvent009: {
      timelineEventId: 'timelineEvent009',
      timelineEventType: 'AuctionRecovered',
      timelineEventDescription: 'Auction state recovered to valid state',
      params: ['rewindedRounds'],
    },
    timelineEvent010: {
      timelineEventId: 'timelineEvent010',
      timelineEventType: 'AuctioneerChanged',
      timelineEventDescription: 'Auctioneer changed',
      params: ['oldAuctionerId', 'newAuctioneerId'],
    },
    timelineEvent011: {
      timelineEventId: 'timelineEvent011',
      timelineEventType: 'Sold',
      timelineEventDescription: 'Current player was sold',
      params: ['playerId', 'winningBid', 'managerId'],
    },
    timelineEvent012: {
      timelineEventId: 'timelineEvent012',
      timelineEventType: 'Unsold',
      timelineEventDescription: 'Current player was unsold',
      params: ['playerId'],
    },
    timelineEvent013: {
      timelineEventId: 'timelineEvent013',
      timelineEventType: 'DraftStarted',
      timelineEventDescription: 'Draft started',
      params: [],
    },
    timelineEvent014: {
      timelineEventId: 'timelineEvent014',
      timelineEventType: 'NextDraftManager',
      timelineEventDescription: "It's the turn of the next manager in the draft sequence",
      params: ['managerId'],
    },
    timelineEvent015: {
      timelineEventId: 'timelineEvent015',
      timelineEventType: 'DraftPick',
      timelineEventDescription: 'Current manager made a draft pick',
      params: ['managerId', 'playerId', 'basePrice'],
    },
    /*
      The three calls are TIME-DRIVEN, not auctioneer buttons. The auctioneer's
      client emits them at 20, 10 and 5 seconds remaining on the round timer,
      and TimeUp at zero. It owns the deadline, so it owns the countdown that
      fires these.
    */
    timelineEvent016: {
      timelineEventId: 'timelineEvent016',
      timelineEventType: 'FirstCall',
      timelineEventDescription: 'First call for bids by auctioneer',
      params: ['timeRemaining'],
    },
    timelineEvent017: {
      timelineEventId: 'timelineEvent017',
      timelineEventType: 'SecondCall',
      timelineEventDescription: 'Second call for bids by auctioneer',
      params: ['timeRemaining'],
    },
    timelineEvent018: {
      timelineEventId: 'timelineEvent018',
      timelineEventType: 'LastCall',
      timelineEventDescription: 'Last call for bids by auctioneer',
      params: ['timeRemaining'],
    },
    timelineEvent019: {
      timelineEventId: 'timelineEvent019',
      timelineEventType: 'TimeUp',
      timelineEventDescription: 'Time up for current bidding ',
      params: [],
    },
    timelineEvent020: {
      timelineEventId: 'timelineEvent020',
      timelineEventType: 'TimeIncreased',
      timelineEventDescription:
        'Time limit for for current bidding increased by auctioneer',
      params: ['timeAdded'],
    },
    timelineEvent021: {
      timelineEventId: 'timelineEvent021',
      timelineEventType: 'AuctionEnded',
      timelineEventDescription: 'Auction ended',
      params: [],
    },
  },

  /*
    ===========================================================
    LIVE AUCTION RUNTIME

    Scoped by leagueId, not by an auctionId — one league has exactly one
    auction, so a separate identity would only force a two-way lookup to
    resolve bidders, squads and config back to the league. The URL falls out
    of this too: /leagues/league002/auction

    TOP-LEVEL, not nested inside leagues/{lid}, because this subtree is written
    many times per second during a session. Nesting it would invalidate every
    reader of league config on every bid.

    THIS NODE DOES NOT EXIST UNTIL THE AUCTION STARTS. startAuction creates it
    and nothing else does. Before then an auction league simply has no entry
    here, which is why Auction Center's pre-auction state reads only the league
    and its members. READ PATHS MUST TREAT ABSENCE AS NORMAL, not as an error.

    Carrying an empty NotStarted shell for the weeks before an auction would be
    a node nothing reads, in a subtree that exists specifically to isolate
    high-frequency write traffic of which there is none yet. phase001
    NotStarted therefore means "room open, first player not yet up" — not "the
    auction is scheduled for next Friday".

    THE READ/WRITE SPLIT IS THE WHOLE DESIGN (spec Step 5) — preserve it:
      - bidders write ONLY to currentSubmittedBids/{playerId}/bids/{their own
        userId} and .../noBids/{their own userId}. Nothing else in this subtree
        is bidder-writable.
      - the auctioneer is the sole writer of everything else, including
        currentPlayer and takingBids.
    This is what makes the design safe with no transactions. The known race —
    the auctioneer may read B's write before A's even if A wrote first — is
    ACCEPTED, not a defect. Live-tested across multiple real auctions.
    ===========================================================
  */
  liveAuctions: {
    // leagueId: liveAuctionObject
    league002: {
      auctionState: {
        currentBatch: {
          playerCategory: 'Marquee',
          playerRole: 'Batsman',
        },
        currentPlayerId: 'player003',
        lastPlayerId: 'player001',
        phase: 'phase006',
        // whose turn it is during the draft. null outside the draft phase.
        // the draft ORDER itself lives in leagues/{lid}/auctionDetails/draftOrder,
        // since it is settled configuration rather than live state.
        currentDraftManagerId: null,
      },

      managerStatus: {
        user002: {
          budget: 94,
          playerList: {
            player001: 6,
            player004: 5.5,
          },
        },
        user003: {
          budget: 100,
          playerList: {},
        },
        user004: {
          budget: 100,
          playerList: {},
        },
      },

      playerWiseBiddingHistory: {
        player001: {
          status: 'Sold',
          bids: {
            bid001: {
              bidId: 'bid001',
              bidNumber: 1,
              bid: 5,
              managerId: 'user003',
              timestamp: 214234,
            },
            bid002: {
              bidId: 'bid002',
              bidNumber: 2,
              bid: 5.5,
              managerId: 'user004',
              timestamp: 234234,
            },
            bid003: {
              bidId: 'bid003',
              bidNumber: 3,
              bid: 6,
              managerId: 'user004',
              timestamp: 234234,
              sold: true,
            },
          },
        },
        player004: {
          status: 'Sold',
          bids: {
            bid001: {
              bidId: 'bid001',
              bidNumber: 1,
              bid: 5,
              managerId: 'user003',
              timestamp: 214234,
            },
            bid002: {
              bidId: 'bid002',
              bidNumber: 2,
              bid: 5.5,
              managerId: 'user004',
              timestamp: 234234,
              sold: true,
            },
          },
        },
      },

      playerStatus: {
        player001: {
          playerId: 'player001',
          status: 'Sold',
          managerId: 'user004',
          winningBid: 6,
        },
        player004: {
          playerId: 'player004',
          status: 'Sold',
          managerId: 'user004',
          winningBid: 5.5,
        },
        player008: {
          playerId: 'player008',
          status: 'Unsold',
        },
        player009: {
          playerId: 'player009',
          status: 'Pending',
        },
      },

      // this is the field auctioneer listens to
      // auctioneer will listen to currentSubmittedBids/{playerId}/bids/{managerId}
      // and
      // currentSubmittedBids/{playerId}/noBids/{managerId}
      // these are only submitted bids, they're not yet accepted by the auctioneer
      // auctioneer logic will validate the bid it receives and then accept
      // this will keep getting overwritten, only current player's bidding live info will be here
      // so before starting next player,
      // currentSubmittedBids/{previousPlayerId} will be deleted
      //
      // WRITE SCOPING: a bidder may write ONLY to
      //   currentSubmittedBids/{playerId}/bids/{their own userId}
      //   currentSubmittedBids/{playerId}/noBids/{their own userId}
      // currentPlayer and takingBids are AUCTIONEER-WRITTEN, bidder-readable.
      // Without that rule a bidder could flip takingBids and reopen bidding.
      currentSubmittedBids: {
        currentPlayer: 'player001',
        takingBids: false,
        player001: {
          bids: {
            user004: 6,
            user004: 5.5,
            user003: 5,
          },
          noBids: {
            user003: true,
            user003: true,
            user003: true,
          },
        },
      },

      // these are the bids auctioneer logic actually validated and accepted
      // this will keep getting overwritten, only the current player's bidding live info will be here
      // so before starting next player
      // currentAcceptedBids/{previousPlayerId} will be deleted
      // ENTIRELY AUCTIONEER-WRITTEN. Bidders read but never write here.
      currentAcceptedBids: {
        takingBids: false,
        currentPlayer: 'player001',
        player001: {
          basePrice: 5,
          currentLeadingBid: 6, // null at the begining
          currentLeadingManager: 'user004',
          minNextBid: 6.5,
          deadline: 23345, // timestamp before which bid needs to be sent. this will always be set to lastBid+30000ms
          bids: {
            // full bidding history of current round
            bid001: {
              bidNumber: 1,
              managerId: 'user003',
              bid: 5,
              timestamp: 234234,
            },
            bid002: {
              bidNumber: 2,
              managerId: 'user004',
              bid: 5.5,
              timestamp: 34345345,
            },
            bid003: {
              bidNumber: 3,
              managerId: 'user004',
              bid: 6,
              timestamp: 34345,
            },
          },
          lastAcceptedBid: 'bid003',
          noBids: {
            noBid001: {
              noBidNumber: 1,
              managerId: 'user003',
              timestamp: 345345,
            },
            noBid002: {
              noBidNumber: 2,
              managerId: 'user003',
              timestamp: 34345,
            },
          },
        },
      },

      timeline: {
        timelineMessage001: {
          timelineMessageId: 'timelineMessage001',
          timelineEventId: 'timelineEvent001',
          timelineEventData: {},
        },
      },
    },
  },
}
