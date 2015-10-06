package plugins

import (
	"encoding/json"
	"errors"
	"os"
	"path"
	"path/filepath"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginMeta struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

type ThirdPartyRoute struct {
	Path            string `json:"path"`
	Method          string `json:"method"`
	ReqSignedIn     bool   `json:"req_signed_in"`
	ReqGrafanaAdmin bool   `json:"req_grafana_admin"`
	ReqRole         string `json:"req_role"`
	Url             string `json:"url"`
}

type ThirdPartyJs struct {
	Src string `json:"src"`
}

type ThirdPartyMenuItem struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Href string `json:"href"`
}

type ThirdPartyCss struct {
	Href string `json:"href"`
}

type ThirdPartyIntegration struct {
	Routes    []*ThirdPartyRoute    `json:"routes"`
	Js        []*ThirdPartyJs       `json:"js"`
	Css       []*ThirdPartyCss      `json:"css"`
	MenuItems []*ThirdPartyMenuItem `json:"menu_items"`
}

type ThirdPartyPlugin struct {
	PluginType  string                `json:"pluginType"`
	Integration ThirdPartyIntegration `json:"integration"`
}

var (
	DataSources  map[string]interface{}
	Integrations []ThirdPartyIntegration
)

type PluginScanner struct {
	pluginPath string
	errors     []error
}

func Init() {
	scan(path.Join(setting.StaticRootPath, "app/plugins"))
}

func scan(pluginDir string) error {
	DataSources = make(map[string]interface{})
	Integrations = make([]ThirdPartyIntegration, 0)

	scanner := &PluginScanner{
		pluginPath: pluginDir,
	}

	if err := filepath.Walk(pluginDir, scanner.walker); err != nil {
		return err
	}

	if len(scanner.errors) > 0 {
		return errors.New("Some plugins failed to load")
	}

	return nil
}

func (scanner *PluginScanner) walker(path string, f os.FileInfo, err error) error {
	if err != nil {
		return err
	}

	if f.IsDir() {
		return nil
	}

	if f.Name() == "plugin.json" {
		err := scanner.loadPluginJson(path)
		if err != nil {
			log.Error(3, "Failed to load plugin json file: %v,  err: %v", path, err)
			scanner.errors = append(scanner.errors, err)
		}
	}
	return nil
}

func (scanner *PluginScanner) loadPluginJson(path string) error {
	reader, err := os.Open(path)
	if err != nil {
		return err
	}

	defer reader.Close()

	jsonParser := json.NewDecoder(reader)

	pluginJson := make(map[string]interface{})
	if err := jsonParser.Decode(&pluginJson); err != nil {
		return err
	}

	pluginType, exists := pluginJson["pluginType"]
	if !exists {
		return errors.New("Did not find pluginType property in plugin.json")
	}

	if pluginType == "datasource" {
		datasourceType, exists := pluginJson["type"]
		if !exists {
			return errors.New("Did not find type property in plugin.json")
		}

		DataSources[datasourceType.(string)] = pluginJson
	}
	if pluginType == "thirdPartyIntegration" {
		p := ThirdPartyPlugin{}
		reader.Seek(0, 0)
		if err := jsonParser.Decode(&p); err != nil {
			return err
		}
		Integrations = append(Integrations, p.Integration)
	}

	return nil
}
