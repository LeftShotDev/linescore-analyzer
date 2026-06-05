I will describe the application we are creating and then you will help me build it. I'm providing you with details first so you can build an understanding, create a context first.

DO NOT BEGIN CODING UNTIL I HAVE ASKED YOU TO BEGIN.

We are creating a new application that makes use of tool calling in LLM applications. We're creating a box score analyzer for the NHL. It will be a chat based interface that allows the user to ask questions about the data set in human language that gets translated via an LLM into query language that can be executed from within your tool.

We want to begin to breakdown the linescore from each game by scraping data from the NHL public API or webpages such as https://www.nhl.com/gamecenter/dal-vs-tbl/2026/01/18/2025020767. The linescore contains the number of goals scored by each team during each period of a game. We want to track trends in the linescore for individiaul teams:
- Did they win the individual period by scoring more goals than the opposing team?
- Did they lose the individual period by scoring fewer goals than the opposing team?
- Did they tie the individual period by scoring the same number of goals as the opposing team?
- Did they score empty net goals?
- Did they win two or more individual periods in regulation?

I believe teams that win two or more individual periods in regulation are more likely to win the games in the future. This is a future indicicator of playoff success -- when you play the same team 4 to 7 games consecutively.

- Create an application connected to a Supabase database to store the data for individual seasons and teams.
- Fill the database with a sufficiently complex mock data set or dataset you find online. You can use the NHL public API to get the data for the 2024-2025 season.
- Then create a chat based interface that allows the user to ask questions about the data set in human language that gets translated via an LLM into query language that can be executed from within your tool.
- Example input and resulting queries:
    - User Request: Display all indiviual period results and cumulative results from Carolina Hurricanes games for the month of Feburary 2025.
    - Tool Interpretation:

        ```jsx
        SELECT linescore_period_results
        FROM linescore_period_results
        WHERE team_id = 'CAR'
        AND date >= '2025-02-01'
        AND date <= '2025-02-28';
        ```

- Your application should be capable of running queries, displaying results, taking in additional input from the user, and correcting its queries.
- As a bonus, consider making tools specific for retrieving, inserting, and updating the database.

Ask me questions to help create the CLAUDE.md file for this project. After that, we'll begin using speckit to build the project.

Do not begin coding.